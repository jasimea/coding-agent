#!/usr/bin/env node

// Test script to demonstrate the new planning-based coding agent
import { CodingAgent } from './dist/agents/coding-agent.js';

async function testPlanningAgent() {
  console.log('🤖 Testing the Planning-Based Coding Agent');
  console.log('==========================================\n');

  const agent = new CodingAgent();
  
  // Test task that will demonstrate planning
  const testTask = "Create a simple README file for this project explaining what it does";
  
  console.log(`Task: ${testTask}\n`);
  
  try {
    console.log('📋 Executing task with planning...\n');
    
    const result = await agent.executeTask({
      task: testTask,
      context: {
        workingDirectory: process.cwd()
      }
    });
    
    console.log('✅ Task completed!');
    console.log(`📊 Status: ${result.status}`);
    console.log(`⏱️  Execution time: ${result.executionTime}ms`);
    console.log(`📋 Steps executed: ${result.steps.length}`);
    
    if (result.plan) {
      console.log('\n📝 Plan Details:');
      console.log(`   ID: ${result.plan.id}`);
      console.log(`   Summary: ${result.plan.summary}`);
      console.log(`   Estimated time: ${result.plan.estimatedTotalTime}`);
      console.log(`   Status: ${result.plan.status}`);
      console.log(`   Steps planned: ${result.plan.steps.length}`);
      
      console.log('\n📋 Plan Steps:');
      result.plan.steps.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step.description}`);
        console.log(`      Action: ${step.action}, Complexity: ${step.complexity}`);
      });
    }
    
    if (result.steps.length > 0) {
      console.log('\n🔧 Executed Steps:');
      result.steps.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step.action} (${step.tool})`);
        if (step.planStepId) {
          console.log(`      Plan Step ID: ${step.planStepId}`);
        }
      });
    }
    
    if (result.error) {
      console.log(`\n❌ Error: ${result.error}`);
    } else if (result.result) {
      console.log(`\n📄 Result: ${result.result.substring(0, 200)}...`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : error);
  }
}

// Run the test
testPlanningAgent();
