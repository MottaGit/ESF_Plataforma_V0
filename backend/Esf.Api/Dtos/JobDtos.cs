using System.Text.Json;
using Esf.Api.Domain;

namespace Esf.Api.Dtos;

/// <summary>
/// Tarefa em segundo plano (relatorio, planilha): a tela pergunta por ela ate ficar pronta e entao baixa o arquivo
/// (FileName) ou le a resposta (Result).
/// </summary>
public record BackgroundJobDto(
    Guid Id,
    BackgroundJobKind Kind,
    BackgroundJobStatus Status,
    // Na fila: quantas tarefas estao na frente (0 = e a proxima).
    int? Ahead,
    string? FileName,
    string? Error,
    JsonElement? Result,
    DateTime CreatedAt,
    DateTime? FinishedAt);
