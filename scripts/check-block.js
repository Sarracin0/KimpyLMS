const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const block = await prisma.gamificationBlock.findUnique({
    where: { lessonBlockId: 'cmggobwt80019keacv5n5to64' },
    include: { lessonBlock: true },
  });
  console.log(JSON.stringify(block, null, 2));
}
main().then(() => prisma.$disconnect()).catch((err) => {
  console.error(err);
  prisma.$disconnect();
});
