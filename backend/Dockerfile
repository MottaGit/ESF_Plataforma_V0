# ---------- build ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Esf.Api/Esf.Api.csproj Esf.Api/
RUN dotnet restore Esf.Api/Esf.Api.csproj
COPY . .
RUN dotnet publish Esf.Api/Esf.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ---------- runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
# libfontconfig1 e libfreetype6 sao necessarios para a geracao de PDF (SkiaSharp/QuestPDF)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libfontconfig1 libfreetype6 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/publish .
RUN mkdir -p /app/App_Data/uploads
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Esf.Api.dll"]
