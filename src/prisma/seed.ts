import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN' },
  });

  const buyerRole = await prisma.role.upsert({
    where: { name: 'BUYER' },
    update: {},
    create: { name: 'BUYER' },
  });

  const solverRole = await prisma.role.upsert({
    where: { name: 'SOLVER' },
    update: {},
    create: { name: 'SOLVER' },
  });

  console.log('✅ Roles created:', { adminRole, buyerRole, solverRole });

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@devwork.com' },
    update: {},
    create: {
      email: 'admin@devwork.com',
      password: hashedPassword,
      name: 'System Admin',
      roles: {
        create: {
          roleId: adminRole.id,
        },
      },
    },
  });

  console.log('✅ Admin user created:', adminUser.email);

  // Create demo buyer
  const buyerPassword = await bcrypt.hash('buyer123', 12);
  const buyerUser = await prisma.user.upsert({
    where: { email: 'buyer@devwork.com' },
    update: {},
    create: {
      email: 'buyer@devwork.com',
      password: buyerPassword,
      name: 'Demo Buyer',
      roles: {
        create: {
          roleId: buyerRole.id,
        },
      },
    },
  });

  console.log('✅ Buyer user created:', buyerUser.email);

  // Create demo solver
  const solverPassword = await bcrypt.hash('solver123', 12);
  const solverUser = await prisma.user.upsert({
    where: { email: 'solver@devwork.com' },
    update: {},
    create: {
      email: 'solver@devwork.com',
      password: solverPassword,
      name: 'Demo Solver',
      roles: {
        create: {
          roleId: solverRole.id,
        },
      },
    },
  });

  console.log('✅ Solver user created:', solverUser.email);

  console.log('🎉 Database seed completed successfully!');
  console.log('\n📝 Demo Credentials:');
  console.log('   Admin:  admin@devwork.com / admin123');
  console.log('   Buyer:  buyer@devwork.com / buyer123');
  console.log('   Solver: solver@devwork.com / solver123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
