import { defineConfig } from 'drizzle-kit'

// Конфиг для drizzle-kit — инструмента разработчика (в приложение не попадает).
// `npm run db:generate` сравнивает schema.ts с прошлыми миграциями
// и создаёт в папке drizzle/ новый SQL-файл с разницей.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/main/core/db/schema.ts',
  out: './drizzle'
})
