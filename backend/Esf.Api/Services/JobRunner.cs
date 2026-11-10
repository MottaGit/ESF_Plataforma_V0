using System.Text.Json;
using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;

namespace Esf.Api.Services;

/// <summary>
/// O que cada tipo de tarefa faz. Roda no escopo criado pelo JobWorker, em que o ICurrentUser e quem pediu: os
/// servicos usados aqui sao os mesmos das rotas, com o mesmo filtro por nucleo e o mesmo historico.
/// </summary>
public class JobRunner
{
    private readonly IServiceProvider _services;

    public JobRunner(IServiceProvider services) => _services = services;

    public async Task<JobOutcome> RunAsync(BackgroundJob job, byte[]? input)
    {
        switch (job.Kind)
        {
            case BackgroundJobKind.Report:
            {
                var request = JobQueue.ReadPayload<ReportRequest>(job);
                var (content, fileName) = await _services.GetRequiredService<ReportService>()
                    .GenerateAsync(request, job.RequestedByName);
                return new JobOutcome(content, fileName);
            }
            case BackgroundJobKind.SpreadsheetExport:
            {
                var request = JobQueue.ReadPayload<ExportSpreadsheetRequest>(job);
                var (content, fileName) = await _services.GetRequiredService<SpreadsheetService>().ExportAsync(request);
                return new JobOutcome(content, fileName);
            }
            case BackgroundJobKind.SpreadsheetImport:
            {
                var request = JobQueue.ReadPayload<SpreadsheetImportJob>(job);
                if (input is null) throw new AppException("O arquivo enviado não foi encontrado. Envie de novo.");
                var result = await _services.GetRequiredService<SpreadsheetImportService>().ImportAsync(input, request.Confirm);
                return new JobOutcome(ResultJson: JsonSerializer.Serialize(result, JobQueue.Json));
            }
            default:
                throw new InvalidOperationException($"Tipo de tarefa sem execucao: {job.Kind}.");
        }
    }
}
