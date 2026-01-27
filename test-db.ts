
import prisma from './src/prisma/client.js';

async function test() {
  try {
    console.log('Testing getMyProjects query structure...');
    
    // Mimic getMyProjects query
    const projects = await prisma.project.findMany({
      take: 5,
      include: {
        solver: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { tasks: true, requests: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`Pjrojects fetched: ${projects.length}`);
    if (projects.length > 0) {
      console.log('First project title:', projects[0].title);
      console.log('Counts:', JSON.stringify(projects[0]._count));
    } else {
      console.log('No projects found.');
    }

    console.log('Testing getOpenProjects query structure...');
    // Mimic getOpenProjects query
    const openProjects = await prisma.project.findMany({
      take: 5,
      where: {
        status: { in: ['OPEN', 'REQUESTED'] },
      },
      include: {
        buyer: {
          select: { id: true, name: true },
        },
        _count: {
          select: { requests: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`Open projects fetched: ${openProjects.length}`);

  } catch (error) {
    console.error('ERROR during query execution:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
