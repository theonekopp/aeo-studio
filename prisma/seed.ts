import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed engines per PRD
  const engines = [
    { name: 'chatgpt', surface: 'direct_answer', region: 'us', device: 'desktop' },
    { name: 'perplexity', surface: 'direct_answer', region: 'us', device: 'desktop' },
  ]

  for (const e of engines) {
    await prisma.engine.upsert({
      where: { name_surface_region_device: {
        name: e.name, surface: e.surface, region: e.region, device: e.device
      } },
      update: {},
      create: e,
    })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
