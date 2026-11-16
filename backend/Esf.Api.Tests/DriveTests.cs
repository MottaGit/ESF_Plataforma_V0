using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Drive;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>
/// Google Drive do nucleo (mao unica): ligar a uma pasta de Drive compartilhado, pastas dos programas e projetos
/// criadas, renomeadas e movidas pela rotina, falhas adiadas e nucleo sem Drive intocado.
/// </summary>
public class DriveTests
{
    private const string ProgramA = "Banheiros";

    /// <summary>Nucleo A ligado a uma pasta "ESF A – Plataforma" de um Drive compartilhado.</summary>
    private sealed class Setup
    {
        public required TwoNucleos F { get; init; }
        public required FakeDriveClient Drive { get; init; }
        public required string Root { get; init; }

        public DriveSettingsService Settings(Data.EsfDbContext db) => new(db, Drive, NullLogger<DriveSettingsService>.Instance);

        public async Task SyncAsync()
        {
            await using var services = JobServices.Create(F.Options);
            await using var db = F.SystemContext();
            await new DriveSyncService(db, Drive, new FileStorageService(db, Options.Create(new StorageOptions())),
                services.GetRequiredService<IServiceScopeFactory>(), NullLogger<DriveSyncService>.Instance).RunUntilIdleAsync();
        }

        /// <summary>Como se o tempo de espera do relatorio final ja tivesse passado.</summary>
        public async Task SkipWaitAsync()
        {
            await using var db = F.SystemContext();
            foreach (var item in await db.DriveItems.Where(i => i.NextAttemptAt != null).ToListAsync()) item.NextAttemptAt = null;
            await db.SaveChangesAsync();
        }

        public FakeDriveClient.Item? At(string path) => Drive.At(Root, path);
    }

    private static async Task<Setup> ConnectedAsync(bool sync = true)
    {
        var f = await TwoNucleos.CreateAsync();
        var drive = new FakeDriveClient();
        var setup = new Setup { F = f, Drive = drive, Root = drive.AddRootFolder("ESF A – Plataforma") };
        await using (var db = f.Context(f.A.Admin))
            await setup.Settings(db).ConnectAsync(new ConnectDriveRequest { FolderLink = FakeDriveClient.LinkTo(setup.Root) });
        if (sync) await setup.SyncAsync();
        return setup;
    }

    private static ProjectService Projects(Data.EsfDbContext db, TestUser user) => new(db, new NotificationService(db, user));

    [Fact]
    public async Task ConnectingCreatesTheFoldersOfOpenProjectsOnly()
    {
        var f = await TwoNucleos.CreateAsync();
        Guid closedId;
        await using (var db = f.Context(f.A.Admin))
        {
            var closed = new Project
            {
                ProgramId = f.A.ProgramId, Name = "Projeto encerrado", StartDate = Mapping.Today.AddDays(-90),
                Status = ProjectStatus.Concluido, ClosedOn = Mapping.Today.AddDays(-5)
            };
            db.Projects.Add(closed);
            await db.SaveChangesAsync();
            closedId = closed.Id;
        }

        var drive = new FakeDriveClient();
        var root = drive.AddRootFolder("ESF A – Plataforma");
        var setup = new Setup { F = f, Drive = drive, Root = root };
        await using (var db = f.Context(f.A.Admin))
        {
            var status = await setup.Settings(db).ConnectAsync(new ConnectDriveRequest { FolderLink = FakeDriveClient.LinkTo(root) });
            Assert.Equal("ESF A – Plataforma", status.FolderName);
            Assert.Equal(DriveNames.FolderUrl(root), status.FolderUrl);
        }

        await setup.SyncAsync();

        // Programa › projeto › subpastas fixas; "Outras fotos" dentro de "04. Fotos e vídeos".
        Assert.Equal(new[] { ProgramA }, drive.ChildNames(root));
        Assert.Equal(new[] { "Projeto a" }, drive.ChildNames(setup.At(ProgramA)!.Id));
        Assert.Equal(
            new[] { "01. Gestão", "02. Projeto técnico", "03. Orçamento e compras", "04. Fotos e vídeos", "05. Documentos" },
            drive.ChildNames(setup.At($"{ProgramA}/Projeto a")!.Id));
        Assert.Equal(new[] { "Outras fotos" }, drive.ChildNames(setup.At($"{ProgramA}/Projeto a/04. Fotos e vídeos")!.Id));
        Assert.Equal(8, drive.Created);

        // Links nas telas: projeto e programa com pasta; o encerrado, sem.
        await using (var db = f.Context(f.A.Admin))
        {
            var detail = await Projects(db, f.A.Admin).GetDetailAsync(f.A.ProjectId);
            Assert.Equal(DriveNames.FolderUrl(setup.At($"{ProgramA}/Projeto a")!.Id), detail.DriveFolderUrl);
            Assert.Null((await Projects(db, f.A.Admin).GetDetailAsync(closedId)).DriveFolderUrl);
            Assert.Equal(DriveNames.FolderUrl(setup.At(ProgramA)!.Id), (await new ProgramService(db).GetAsync(f.A.ProgramId)).DriveFolderUrl);

            var status = await setup.Settings(db).GetAsync();
            Assert.Equal((1, 0, 0), (status.ProjectsWithFolder, status.Pending, status.Failed));
        }

        // Rodar de novo nao duplica nada; o nucleo B (sem Drive) nao ganhou nada.
        await setup.SyncAsync();
        Assert.Equal(8, drive.Created);
        await using (var db = f.Context(f.B.Admin))
        {
            Assert.Null((await Projects(db, f.B.Admin).GetDetailAsync(f.B.ProjectId)).DriveFolderUrl);
            Assert.Empty(await db.DriveItems.ToListAsync());
        }
    }

    [Fact]
    public async Task NewProjectsGetAFolderAndRenamingOrMovingFollows()
    {
        var setup = await ConnectedAsync();
        var f = setup.F;
        Guid newProgramId;
        Guid newProjectId;
        await using (var db = f.Context(f.A.Admin))
        {
            var program = new ProjectProgram { Name = "Hortas" };
            var project = new Project { ProgramId = f.A.ProgramId, Name = "Casa da Alessandra / Sarandi", StartDate = Mapping.Today };
            db.AddRange(program, project);
            await db.SaveChangesAsync();
            (newProgramId, newProjectId) = (program.Id, project.Id);
        }

        await setup.SyncAsync();
        // Programa novo ganha pasta mesmo sem projeto; a barra do nome vira traco.
        Assert.Equal(new[] { ProgramA, "Hortas" }, setup.Drive.ChildNames(setup.Root));
        var folder = setup.At($"{ProgramA}/Casa da Alessandra - Sarandi")!;
        Assert.Equal(5, setup.Drive.Children(folder.Id).Count);

        await using (var db = f.Context(f.A.Admin))
        {
            var project = await db.Projects.SingleAsync(p => p.Id == newProjectId);
            project.Name = "Casa da Alessandra";
            project.ProgramId = newProgramId;
            var program = await db.Programs.SingleAsync(p => p.Id == newProgramId);
            program.Name = "Hortas urbanas";
            await db.SaveChangesAsync();
        }

        await setup.SyncAsync();
        // A mesma pasta (com o que tiver dentro), renomeada e no programa novo, tambem renomeado.
        var moved = setup.At("Hortas urbanas/Casa da Alessandra")!;
        Assert.Equal(folder.Id, moved.Id);
        Assert.Equal(5, setup.Drive.Children(moved.Id).Count);
        Assert.Equal(new[] { "Projeto a" }, setup.Drive.ChildNames(setup.At(ProgramA)!.Id));
    }

    [Fact]
    public async Task FolderDeletedInDriveIsCreatedAgain()
    {
        var setup = await ConnectedAsync();
        setup.Drive.DeleteForever(setup.At(ProgramA)!.Id);

        await using (var db = setup.F.Context(setup.F.A.Admin))
        {
            var project = await db.Projects.SingleAsync(p => p.Id == setup.F.A.ProjectId);
            project.Name = "Projeto a (obra)";
            await db.SaveChangesAsync();
        }

        await setup.SyncAsync();
        Assert.Equal(5, setup.Drive.Children(setup.At($"{ProgramA}/Projeto a (obra)")!.Id).Count);
    }

    [Fact]
    public async Task GoogleOutOfTheAirOnlyPostponesAndRetryResumes()
    {
        var setup = await ConnectedAsync(sync: false);
        setup.Drive.Down = true;
        await setup.SyncAsync();
        Assert.Empty(setup.Drive.Children(setup.Root));

        await using (var db = setup.F.Context(setup.F.A.Admin))
        {
            var item = await db.DriveItems.SingleAsync(i => i.Kind == DriveItemKind.Projeto);
            Assert.Equal((DriveItemState.Pendente, 1), (item.State, item.Attempts));
            Assert.True(item.NextAttemptAt > DateTime.UtcNow);

            // Esperam o projeto (a pasta do programa vem junto com a dele) e a copia da foto que ele ja tinha.
            var status = await setup.Settings(db).GetAsync();
            Assert.Equal(2, status.Pending);
            Assert.StartsWith("Não foi possível falar com o Google Drive", status.LastError);
        }

        // Antes do intervalo, a rotina nao insiste; "Tentar de novo" poe na fila agora.
        setup.Drive.Down = false;
        await setup.SyncAsync();
        Assert.Empty(setup.Drive.Children(setup.Root));
        await using (var db = setup.F.Context(setup.F.A.Admin))
            await setup.Settings(db).RetryAsync();
        await setup.SyncAsync();
        Assert.NotNull(setup.At($"{ProgramA}/Projeto a"));
    }

    [Fact]
    public async Task ManyFailuresStopUntilSomeoneRetries()
    {
        var setup = await ConnectedAsync(sync: false);
        setup.Drive.Down = true;
        for (var attempt = 0; attempt < DriveSyncService.MaxAttempts; attempt++)
        {
            await setup.SyncAsync();
            await using var db = setup.F.SystemContext();
            foreach (var item in await db.DriveItems.ToListAsync()) item.NextAttemptAt = null;
            await db.SaveChangesAsync();
        }

        await using (var db = setup.F.Context(setup.F.A.Admin))
        {
            Assert.All(await db.DriveItems.ToListAsync(), item => Assert.Equal(DriveItemState.Falhou, item.State));
            Assert.Equal(2, (await setup.Settings(db).GetAsync()).Failed);
        }

        setup.Drive.Down = false;
        await using (var db = setup.F.Context(setup.F.A.Admin))
            await setup.Settings(db).RetryAsync();
        await setup.SyncAsync();
        Assert.NotNull(setup.At($"{ProgramA}/Projeto a"));
    }

    [Fact]
    public async Task ConnectingChecksTheFolderBeforeSaving()
    {
        var f = await TwoNucleos.CreateAsync();
        var drive = new FakeDriveClient();
        var myDrive = drive.AddRootFolder("Pasta no Meu Drive", sharedDrive: false);
        var readOnly = drive.AddRootFolder("Só leitura", canAddChildren: false);
        await using var db = f.Context(f.A.Admin);
        var settings = new DriveSettingsService(db, drive, NullLogger<DriveSettingsService>.Instance);

        async Task<string> Refused(string link) =>
            (await Assert.ThrowsAsync<AppException>(() => settings.ConnectAsync(new ConnectDriveRequest { FolderLink = link }))).Message;

        Assert.StartsWith("Cole o link de uma pasta", await Refused("https://docs.google.com/document/d/x"));
        Assert.Contains(drive.AccountEmail!, await Refused(FakeDriveClient.LinkTo("pastaQueNaoExiste123")));
        Assert.StartsWith("A pasta precisa estar num Drive compartilhado", await Refused(FakeDriveClient.LinkTo(myDrive)));
        Assert.Contains("Gerente de conteúdo", await Refused(FakeDriveClient.LinkTo(readOnly)));

        drive.IsConfigured = false;
        Assert.Contains("não foi configurada no servidor", await Refused(FakeDriveClient.LinkTo(readOnly)));
        Assert.False((await settings.GetAsync()).Available);
        Assert.Null((await db.Organizations.SingleAsync()).DriveFolderId);
    }

    [Fact]
    public async Task DisconnectingStopsTheRoutineAndKeepsWhatIsInTheDrive()
    {
        var setup = await ConnectedAsync();
        await using (var db = setup.F.Context(setup.F.A.Admin))
        {
            await setup.Settings(db).DisconnectAsync();
            var project = await db.Projects.SingleAsync(p => p.Id == setup.F.A.ProjectId);
            project.Name = "Outro nome";
            await db.SaveChangesAsync();
            Assert.Null((await Projects(db, setup.F.A.Admin).GetDetailAsync(setup.F.A.ProjectId)).DriveFolderUrl);
        }

        await setup.SyncAsync();
        Assert.NotNull(setup.At($"{ProgramA}/Projeto a"));
        await using (var db = setup.F.SystemContext())
        {
            Assert.Empty(await db.DriveItems.ToListAsync());
            Assert.Empty(await db.DriveSyncRequests.ToListAsync());
        }
    }

    // ---------- copias de fotos e documentos ----------

    private const string Photos = $"{ProgramA}/Projeto a/04. Fotos e vídeos";
    private const string Others = $"{Photos}/Outras fotos";
    private const string Documents = $"{ProgramA}/Projeto a/05. Documentos";

    private static string Folder(DateOnly day, string kind, int position = 1) => DriveNames.RecordFolder(day, kind, position);

    private static ProjectFile NewFile(Data.EsfDbContext db, Guid projectId, string name, string contentType)
    {
        var stored = $"{Guid.NewGuid():N}{Path.GetExtension(name)}";
        db.StoredFiles.Add(new StoredFile { StoredName = stored, ContentType = contentType, SizeBytes = 3, Content = new byte[] { 1, 2, 3 } });
        return new ProjectFile { ProjectId = projectId, FileName = name, StoredName = stored, ContentType = contentType, SizeBytes = 3 };
    }

    /// <summary>Registro de andamento do projeto A com os anexos (nome, tipo de conteudo), publicado pelo admin.</summary>
    private static Task<(Guid Id, List<Guid> Files)> AddRecordAsync(TwoNucleos f, ProjectUpdateKind? kind, DateOnly day,
        params (string Name, string Type)[] files) => AddRecordAsync(f, f.A.ProjectId, kind, day, files);

    private static async Task<(Guid Id, List<Guid> Files)> AddRecordAsync(TwoNucleos f, Guid projectId, ProjectUpdateKind? kind,
        DateOnly day, params (string Name, string Type)[] files)
    {
        await using var db = f.Context(f.A.Admin);
        var record = new ProjectUpdate
        {
            ProjectId = projectId, Text = "<p>Registro</p>", AuthorUserId = f.A.AdminUserId, HappenedOn = day, Kind = kind
        };
        foreach (var (name, type) in files) record.Attachments.Add(NewFile(db, projectId, name, type));
        db.ProjectUpdates.Add(record);
        await db.SaveChangesAsync();
        return (record.Id, record.Attachments.Select(a => a.Id).ToList());
    }

    private static async Task<Guid> AddProjectFileAsync(TwoNucleos f, string name, string type, Guid? activityId = null)
    {
        await using var db = f.Context(f.A.Admin);
        var file = NewFile(db, f.A.ProjectId, name, type);
        file.ActivityId = activityId;
        db.ProjectFiles.Add(file);
        await db.SaveChangesAsync();
        return file.Id;
    }

    private static async Task SetKindAsync(TwoNucleos f, Guid recordId, ProjectUpdateKind? kind, DateOnly? day = null)
    {
        await using var db = f.Context(f.A.Admin);
        var record = await db.ProjectUpdates.SingleAsync(u => u.Id == recordId);
        record.Kind = kind;
        if (day.HasValue) record.HappenedOn = day;
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task PhotosAndDocumentsGoToTheRightFolders()
    {
        var setup = await ConnectedAsync();
        var f = setup.F;
        var day = Mapping.Today.AddDays(-2);
        await AddRecordAsync(f, ProjectUpdateKind.Obra, day, ("piso.jpg", "image/jpeg"), ("orcamento.pdf", "application/pdf"));
        await AddRecordAsync(f, null, Mapping.Today.AddDays(-1), ("reuniao.jpg", "image/jpeg"));
        await AddProjectFileAsync(f, "fachada.jpg", "image/jpeg");
        await AddProjectFileAsync(f, "planta.dwg", "application/octet-stream");
        await AddProjectFileAsync(f, "referencia.png", "image/png", f.A.ActivityId);

        await setup.SyncAsync();

        Assert.Equal(new[] { Folder(day, "Obra"), "Outras fotos" }, setup.Drive.ChildNames(setup.At(Photos)!.Id));
        Assert.Equal(new[] { "piso.jpg" }, setup.Drive.ChildNames(setup.At($"{Photos}/{Folder(day, "Obra")}")!.Id));
        // Sem tipo, da tarefa e da aba Arquivos: "Outras fotos". Documento de qualquer lugar: "05. Documentos".
        Assert.Equal(new[] { "fachada.jpg", "referencia.png", "reuniao.jpg" }, setup.Drive.ChildNames(setup.At(Others)!.Id));
        Assert.Equal(new[] { "orcamento.pdf", "planta.dwg" }, setup.Drive.ChildNames(setup.At(Documents)!.Id));
        Assert.Equal(new byte[] { 1, 2, 3 }, setup.At($"{Photos}/{Folder(day, "Obra")}/piso.jpg")!.Content);

        // Rodar de novo nao duplica; o nucleo B (sem Drive) continua sem nada.
        var created = setup.Drive.Created;
        await setup.SyncAsync();
        Assert.Equal(created, setup.Drive.Created);
        await using var db = f.SystemContext();
        Assert.DoesNotContain(await db.DriveItems.ToListAsync(), i => i.OrganizationId == f.B.OrganizationId);
    }

    [Fact]
    public async Task ChangingTheKindRenamesOrEmptiesTheRecordFolder()
    {
        var setup = await ConnectedAsync();
        var f = setup.F;
        var day = Mapping.Today.AddDays(-3);
        var record = await AddRecordAsync(f, ProjectUpdateKind.Obra, day, ("piso.jpg", "image/jpeg"));
        await setup.SyncAsync();
        var folder = setup.At($"{Photos}/{Folder(day, "Obra")}")!;

        // Outro tipo e outro dia: a mesma pasta, renomeada.
        await SetKindAsync(f, record.Id, ProjectUpdateKind.VisitaTecnica, day.AddDays(-1));
        await setup.SyncAsync();
        Assert.Equal(folder.Id, setup.At($"{Photos}/{Folder(day.AddDays(-1), "Visita técnica")}")!.Id);

        // Sem tipo: a foto vai para "Outras fotos" e a pasta, vazia, para a lixeira.
        await SetKindAsync(f, record.Id, null);
        await setup.SyncAsync();
        Assert.Equal(new[] { "piso.jpg" }, setup.Drive.ChildNames(setup.At(Others)!.Id));
        Assert.True(setup.Drive.Items[folder.Id].Trashed);
        Assert.Equal(new[] { "Outras fotos" }, setup.Drive.ChildNames(setup.At(Photos)!.Id));

        // Tipo de novo: pasta nova, com a foto.
        await SetKindAsync(f, record.Id, ProjectUpdateKind.EntregaFinal);
        await setup.SyncAsync();
        Assert.Equal(new[] { "piso.jpg" },
            setup.Drive.ChildNames(setup.At($"{Photos}/{Folder(day.AddDays(-1), "Entrega final")}")!.Id));
        Assert.Empty(setup.Drive.Children(setup.At(Others)!.Id));
    }

    [Fact]
    public async Task SameKindTwiceOnTheSameDayGetsANumber()
    {
        var setup = await ConnectedAsync();
        var day = Mapping.Today;
        await AddRecordAsync(setup.F, ProjectUpdateKind.Obra, day, ("manha.jpg", "image/jpeg"));
        await AddRecordAsync(setup.F, ProjectUpdateKind.Obra, day, ("tarde.jpg", "image/jpeg"));
        // Registro do mesmo tipo e dia, mas sem foto, nao conta (nao tem pasta).
        await AddRecordAsync(setup.F, ProjectUpdateKind.Obra, day);
        await setup.SyncAsync();

        Assert.Equal(new[] { Folder(day, "Obra"), Folder(day, "Obra", 2), "Outras fotos" },
            setup.Drive.ChildNames(setup.At(Photos)!.Id));
        Assert.Equal(new[] { "tarde.jpg" }, setup.Drive.ChildNames(setup.At($"{Photos}/{Folder(day, "Obra", 2)}")!.Id));
    }

    [Fact]
    public async Task DeletingInThePlatformSendsTheCopyToTheTrashButDeletingTheProjectKeepsAll()
    {
        var setup = await ConnectedAsync();
        var f = setup.F;
        var day = Mapping.Today;
        var record = await AddRecordAsync(f, ProjectUpdateKind.Obra, day, ("piso.jpg", "image/jpeg"));
        var loose = await AddProjectFileAsync(f, "fachada.jpg", "image/jpeg");
        await AddProjectFileAsync(f, "contrato.pdf", "application/pdf");
        await setup.SyncAsync();
        var recordFolder = setup.At($"{Photos}/{Folder(day, "Obra")}")!;
        var looseCopy = setup.At($"{Others}/fachada.jpg")!;

        await using (var db = f.Context(f.A.Admin))
        {
            db.ProjectFiles.Remove(await db.ProjectFiles.SingleAsync(x => x.Id == loose));
            db.ProjectUpdates.Remove(await db.ProjectUpdates.Include(u => u.Attachments).SingleAsync(u => u.Id == record.Id));
            await db.SaveChangesAsync();
        }

        await setup.SyncAsync();
        Assert.True(setup.Drive.Items[looseCopy.Id].Trashed);
        Assert.True(setup.Drive.Items[recordFolder.Id].Trashed);
        Assert.False(setup.At($"{Documents}/contrato.pdf")!.Trashed);

        // Excluir o projeto nao apaga nada no Drive (nem a pasta, nem o que esta nela).
        await using (var db = f.Context(f.A.Admin))
            await Projects(db, f.A.Admin).DeleteAsync(f.A.ProjectId);
        await setup.SyncAsync();
        Assert.NotNull(setup.At($"{Documents}/contrato.pdf"));
        Assert.False(setup.At($"{Documents}/contrato.pdf")!.Trashed);
    }

    [Fact]
    public async Task ClosedProjectGetsItsFolderWhenSomethingArrives()
    {
        var setup = await ConnectedAsync();
        var f = setup.F;
        Guid closedId;
        await using (var db = f.Context(f.A.Admin))
        {
            var closed = new Project
            {
                ProgramId = f.A.ProgramId, Name = "Projeto encerrado", StartDate = Mapping.Today.AddDays(-90),
                Status = ProjectStatus.Concluido, ClosedOn = Mapping.Today.AddDays(-1)
            };
            db.Projects.Add(closed);
            await db.SaveChangesAsync();
            closedId = closed.Id;
        }

        await setup.SyncAsync();
        Assert.Null(setup.At($"{ProgramA}/Projeto encerrado"));

        // Duas fotos num registro com tipo: a pasta do projeto nasce uma vez so (no banco, um item por coisa).
        var day = Mapping.Today;
        await AddRecordAsync(f, closedId, ProjectUpdateKind.EntregaFinal, day, ("antes.jpg", "image/jpeg"), ("depois.jpg", "image/jpeg"));
        await setup.SyncAsync();
        Assert.Equal(new[] { "antes.jpg", "depois.jpg" },
            setup.Drive.ChildNames(setup.At($"{ProgramA}/Projeto encerrado/04. Fotos e vídeos/{Folder(day, "Entrega final")}")!.Id));
        await using var check = f.SystemContext();
        Assert.Single(await check.DriveItems.Where(i => i.Kind == DriveItemKind.Projeto && i.EntityId == closedId).ToListAsync());
    }

    [Fact]
    public async Task ConnectingCopiesWhatOpenProjectsAlreadyHave()
    {
        var setup = await ConnectedAsync(sync: false);
        await using (var db = setup.F.Context(setup.F.A.Admin))
            await setup.Settings(db).DisconnectAsync();

        var day = Mapping.Today.AddDays(-5);
        await AddRecordAsync(setup.F, ProjectUpdateKind.VisitaTecnica, day, ("terreno.jpg", "image/jpeg"));
        await AddProjectFileAsync(setup.F, "levantamento.pdf", "application/pdf");

        await using (var db = setup.F.Context(setup.F.A.Admin))
            await setup.Settings(db).ConnectAsync(new ConnectDriveRequest { FolderLink = FakeDriveClient.LinkTo(setup.Root) });
        await setup.SyncAsync();

        Assert.NotNull(setup.At($"{Photos}/{Folder(day, "Visita técnica")}/terreno.jpg"));
        Assert.NotNull(setup.At($"{Documents}/levantamento.pdf"));
    }

    // ---------- relatorio final ----------

    [Fact]
    public async Task ConcludingPutsTheFinalReportInTheProjectFolder()
    {
        var setup = await ConnectedAsync();
        var f = setup.F;
        var day = Mapping.Today.AddDays(-1);
        await using (var db = f.Context(f.A.Admin))
            await Projects(db, f.A.Admin).UpdateStatusAsync(f.A.ProjectId, ProjectStatus.Concluido, day);

        // Espera um pouco (registro de encerramento e numeros finais chegam logo depois).
        await setup.SyncAsync();
        var reportName = $"Relatório final – Projeto a – {day:yyyy-MM-dd}.pdf";
        Assert.Null(setup.At($"{ProgramA}/Projeto a/{reportName}"));

        await setup.SkipWaitAsync();
        await setup.SyncAsync();
        var report = setup.At($"{ProgramA}/Projeto a/{reportName}")!;
        Assert.Equal("application/pdf", report.ContentType);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(report.Content!, 0, 4));

        // Reaberto e concluido de novo noutro dia: outro relatorio, o primeiro fica.
        await using (var db = f.Context(f.A.Admin))
        {
            await Projects(db, f.A.Admin).UpdateStatusAsync(f.A.ProjectId, ProjectStatus.EmAndamento);
            await Projects(db, f.A.Admin).UpdateStatusAsync(f.A.ProjectId, ProjectStatus.Concluido, Mapping.Today);
        }
        await setup.SyncAsync();
        await setup.SkipWaitAsync();
        await setup.SyncAsync();
        Assert.NotNull(setup.At($"{ProgramA}/Projeto a/{reportName}"));
        Assert.NotNull(setup.At($"{ProgramA}/Projeto a/Relatório final – Projeto a – {Mapping.Today:yyyy-MM-dd}.pdf"));
    }

    [Fact]
    public async Task ReopenedBeforeTheReportOrCancelledMakesNoReport()
    {
        var setup = await ConnectedAsync();
        var f = setup.F;
        await using (var db = f.Context(f.A.Admin))
        {
            await Projects(db, f.A.Admin).UpdateStatusAsync(f.A.ProjectId, ProjectStatus.Concluido);
            await Projects(db, f.A.Admin).UpdateStatusAsync(f.A.ProjectId, ProjectStatus.EmAndamento);
            await Projects(db, f.A.Admin).UpdateStatusAsync(f.A.ProjectId, ProjectStatus.Cancelado);
        }

        await setup.SyncAsync();
        await setup.SkipWaitAsync();
        await setup.SyncAsync();
        Assert.DoesNotContain(setup.Drive.ChildNames(setup.At($"{ProgramA}/Projeto a")!.Id), name => name.EndsWith(".pdf"));
        await using var check = f.SystemContext();
        Assert.DoesNotContain(await check.DriveItems.ToListAsync(), i => i.Kind == DriveItemKind.RelatorioFinal);
    }

    [Theory]
    [InlineData("https://drive.google.com/drive/folders/1AbC_def-GHIjkl?usp=sharing", "1AbC_def-GHIjkl")]
    [InlineData("https://drive.google.com/drive/u/1/folders/1AbC_def-GHIjkl", "1AbC_def-GHIjkl")]
    [InlineData("https://drive.google.com/open?id=1AbC_def-GHIjkl", "1AbC_def-GHIjkl")]
    [InlineData("  1AbC_def-GHIjkl ", "1AbC_def-GHIjkl")]
    [InlineData("https://docs.google.com/document/d/1AbC/edit", null)]
    [InlineData("", null)]
    public void FolderIdComesFromTheLink(string link, string? id) => Assert.Equal(id, DriveNames.FolderIdFrom(link));
}
