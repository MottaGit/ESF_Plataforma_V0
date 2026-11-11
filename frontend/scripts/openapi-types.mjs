// Gera src/types/openapi.ts a partir de openapi.json, o contrato da API (OpenAPI do /swagger), que o teste
// OpenApiContractTests do backend mantem em dia. Sem dependencias: o contrato so usa objetos, enums de texto, listas,
// referencias e nulos. Uso: npm run types (ou node scripts/openapi-types.mjs).
import { readFileSync, writeFileSync } from 'node:fs';

const input = new URL('../openapi.json', import.meta.url);
const output = new URL('../src/types/openapi.ts', import.meta.url);
const schemas = JSON.parse(readFileSync(input, 'utf8')).components?.schemas ?? {};

const nameOf = (ref) => ref.split('/').pop();
const nullable = (type, isNullable) => (isNullable ? `${type} | null` : type);
const inParens = (type) => (/[|&]/.test(type) ? `(${type})` : type);

function typeOf(schema) {
  if (schema.$ref) return nameOf(schema.$ref);
  // Referencia que pode vir null (UseAllOfToExtendReferenceSchemas no backend).
  if (schema.allOf?.length === 1) return nullable(typeOf(schema.allOf[0]), schema.nullable);
  if (schema.enum) return nullable(schema.enum.map((value) => JSON.stringify(value).replace(/"/g, "'")).join(' | '), schema.nullable);

  let type;
  switch (schema.type) {
    case 'string':
      type = schema.format === 'binary' ? 'Blob' : 'string';
      break;
    case 'integer':
    case 'number':
      type = 'number';
      break;
    case 'boolean':
      type = 'boolean';
      break;
    case 'array':
      type = `${inParens(typeOf(schema.items ?? {}))}[]`;
      break;
    case 'object':
      if (schema.properties) type = `{ ${properties(schema).join(' ')} }`;
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object')
        type = `Record<string, ${typeOf(schema.additionalProperties)}>`;
      else type = 'Record<string, unknown>';
      break;
    default:
      type = 'unknown';
  }
  return nullable(type, schema.nullable);
}

// A API sempre manda todas as propriedades (vazias como null), entao nenhuma e opcional.
function properties(schema) {
  return Object.entries(schema.properties ?? {}).map(([name, property]) => `${name}: ${typeOf(property)};`);
}

const lines = [
  '// Gerado por scripts/openapi-types.mjs a partir de openapi.json (o contrato da API). Nao edite a mao: depois de',
  '// mudar um DTO, rode no backend `ESF_UPDATE_OPENAPI=1 dotnet test --filter OpenApiContractTests` e aqui',
  '// `npm run types`. Os nomes sao os dos DTOs do backend; types/api.ts da os nomes usados nas telas.',
  ''
];
for (const name of Object.keys(schemas).sort()) {
  const schema = schemas[name];
  if (schema.enum) {
    lines.push(`export type ${name} = ${typeOf({ ...schema, nullable: false })};`, '');
  } else if (schema.type === 'object' && schema.properties) {
    lines.push(`export interface ${name} {`, ...properties(schema).map((line) => `  ${line}`), '}', '');
  } else {
    lines.push(`export type ${name} = ${typeOf(schema)};`, '');
  }
}

writeFileSync(output, lines.join('\n').replace(/\n+$/, '\n'));
console.log(`${Object.keys(schemas).length} tipos em src/types/openapi.ts`);
