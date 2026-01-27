
import prisma from './src/prisma/client.js';

async function testFeedbackPersistence() {
  try {
    console.log('Starting persistence test...');

    // 1. Find a buyer and a project (or create mocks if needed, but let's try to find existing first)
    // We need a task to update.
    const task = await prisma.task.findFirst();
    
    if (!task) {
        console.log("No task found to test.");
        return;
    }

    console.log(`Testing with task ID: ${task.id}`);
    console.log(`Current reviewFeedback: ${task.reviewFeedback}`);

    const testFeedback = `Test feedback timestamp: ${new Date().toISOString()}`;

    // 2. Update the task
    console.log(`Updating task with feedback: "${testFeedback}"`);
    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        reviewFeedback: testFeedback
      }
    });

    // 3. Verify return value
    console.log(`Update Result reviewFeedback: ${updatedTask.reviewFeedback}`);

    // 4. Fetch again to double check
    const fetchedTask = await prisma.task.findUnique({
      where: { id: task.id },
      select: { id: true, reviewFeedback: true }
    });
    console.log(`Refetched reviewFeedback: ${fetchedTask?.reviewFeedback}`);

    if (fetchedTask?.reviewFeedback === testFeedback) {
        console.log("✅ Persistence SUCCESS");
    } else {
        console.log("❌ Persistence FAILED");
    }

  } catch (error) {
    console.error('Test Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFeedbackPersistence();
