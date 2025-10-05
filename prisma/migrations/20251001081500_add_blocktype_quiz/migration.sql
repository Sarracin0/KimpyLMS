-- Add QUIZ value to BlockType enum if missing
ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'QUIZ';
