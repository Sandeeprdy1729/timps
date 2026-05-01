// ── TIMPS Skill Weaver — Self-Improving Skills
// Inspired by Hermes Agent's skill creation from experience

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface Skill {
  id: string;
  name: string;
  description: string;
  trigger: string;
  response: string;
  examples: string[];
  category: string;
  usageCount: number;
  successRate: number;
  createdAt: number;
  updatedAt: number;
  autoCreated: boolean;
}

export class SkillWeaver {
  private skillsDir: string;
  private skills: Map<string, Skill> = new Map();
  
  constructor(skillsDir?: string) {
    this.skillsDir = skillsDir || path.join(os.homedir(), '.timps', 'skills');
    this.ensureDir();
    this.loadSkills();
  }
  
  private ensureDir(): void {
    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
    }
  }
  
  private loadSkills(): void {
    try {
      const entries = fs.readdirSync(this.skillsDir);
      for (const entry of entries) {
        const skillPath = path.join(this.skillsDir, entry);
        if (entry.endsWith('.json') && fs.statSync(skillPath).isFile()) {
          const skill = JSON.parse(fs.readFileSync(skillPath, 'utf-8')) as Skill;
          this.skills.set(skill.id, skill);
        }
      }
    } catch (e) {
      // Start fresh
    }
  }
  
  async createSkill(params: {
    name: string;
    description: string;
    trigger: string;
    response: string;
    examples?: string[];
    category?: string;
  }): Promise<Skill> {
    const skill: Skill = {
      id: `skill_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: params.name,
      description: params.description,
      trigger: params.trigger,
      response: params.response,
      examples: params.examples || [],
      category: params.category || 'general',
      usageCount: 0,
      successRate: 0.5,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      autoCreated: true,
    };
    
    const skillPath = path.join(this.skillsDir, `${skill.id}.json`);
    fs.writeFileSync(skillPath, JSON.stringify(skill, null, 2));
    this.skills.set(skill.id, skill);
    
    return skill;
  }
  
  async learnFromInteraction(
    userMessage: string,
    assistantResponse: string,
    success: boolean
  ): Promise<void> {
    // Extract potential skill patterns
    const patterns = this.extractPatterns(userMessage, assistantResponse);
    
    for (const pattern of patterns) {
      // Check if similar skill exists
      const existing = this.findSimilarSkill(pattern.trigger);
      if (existing) {
        // Update existing skill
        existing.usageCount++;
        if (success) {
          existing.successRate = (existing.successRate * (existing.usageCount - 1) + 1) / existing.usageCount;
        } else {
          existing.successRate = (existing.successRate * (existing.usageCount - 1)) / existing.usageCount;
        }
        existing.updatedAt = Date.now();
        
        // Save
        const skillPath = path.join(this.skillsDir, `${existing.id}.json`);
        fs.writeFileSync(skillPath, JSON.stringify(existing, null, 2));
      } else if (success && pattern.quality > 0.7) {
        // Create new skill from high-quality interaction
        await this.createSkill({
          name: pattern.name,
          description: `Auto-learned: ${pattern.description}`,
          trigger: pattern.trigger,
          response: pattern.response,
          examples: [userMessage],
          category: pattern.category,
        });
      }
    }
  }
  
  private extractPatterns(
    userMessage: string,
    assistantResponse: string
  ): Array<{
    trigger: string;
    response: string;
    name: string;
    description: string;
    quality: number;
    category: string;
  }> {
    const patterns: Array<{
      trigger: string;
      response: string;
      name: string;
      description: string;
      quality: number;
      category: string;
    }> = [];
    
    // Pattern 1: Code patterns (try-catch, error handling)
    if (/\b(try|catch|error|exception|handle)\b/i.test(userMessage) && 
        /\bcatch\b/.test(assistantResponse)) {
      patterns.push({
        trigger: 'error handling',
        response: assistantResponse,
        name: 'Error Handler',
        description: 'Pattern for handling errors gracefully',
        quality: 0.8,
        category: 'development',
      });
    }
    
    // Pattern 2: Testing patterns
    if (/\b(test|unit test|spec)\b/i.test(userMessage)) {
      patterns.push({
        trigger: 'write test',
        response: assistantResponse,
        name: 'Test Writer',
        description: 'Pattern for writing tests',
        quality: 0.75,
        category: 'testing',
      });
    }
    
    // Pattern 3: API patterns
    if (/\b(api|endpoint|route|request)\b/i.test(userMessage)) {
      patterns.push({
        trigger: 'create api',
        response: assistantResponse,
        name: 'API Creator',
        description: 'Pattern for creating APIs',
        quality: 0.7,
        category: 'development',
      });
    }
    
    // Pattern 4: Database patterns
    if (/\b(database|query|sql|migration)\b/i.test(userMessage)) {
      patterns.push({
        trigger: 'database operation',
        response: assistantResponse,
        name: 'DB Handler',
        description: 'Pattern for database operations',
        quality: 0.75,
        category: 'database',
      });
    }
    
    return patterns;
  }
  
  private findSimilarSkill(trigger: string): Skill | null {
    const triggerLower = trigger.toLowerCase();
    for (const skill of this.skills.values()) {
      if (skill.trigger.toLowerCase() === triggerLower ||
          skill.trigger.toLowerCase().includes(triggerLower) ||
          triggerLower.includes(skill.trigger.toLowerCase())) {
        return skill;
      }
    }
    return null;
  }
  
  async findMatchingSkill(input: string): Promise<Skill | null> {
    const inputLower = input.toLowerCase();
    
    for (const skill of this.skills.values()) {
      if (inputLower.includes(skill.trigger.toLowerCase())) {
        // Increment usage
        skill.usageCount++;
        skill.updatedAt = Date.now();
        
        const skillPath = path.join(this.skillsDir, `${skill.id}.json`);
        fs.writeFileSync(skillPath, JSON.stringify(skill, null, 2));
        
        return skill;
      }
    }
    
    return null;
  }
  
  async listSkills(category?: string): Promise<Skill[]> {
    const skills = [...this.skills.values()];
    if (category) {
      return skills.filter(s => s.category === category);
    }
    return skills.sort((a, b) => b.usageCount - a.usageCount);
  }
  
  async getSkill(name: string): Promise<Skill | null> {
    for (const skill of this.skills.values()) {
      if (skill.name.toLowerCase() === name.toLowerCase()) {
        return skill;
      }
    }
    return null;
  }
  
  async deleteSkill(skillId: string): Promise<boolean> {
    const skill = this.skills.get(skillId);
    if (skill) {
      const skillPath = path.join(this.skillsDir, `${skillId}.json`);
      fs.unlinkSync(skillPath);
      this.skills.delete(skillId);
      return true;
    }
    return false;
  }
  
  getSkillStats(): {
    total: number;
    autoCreated: number;
    topSkills: Array<{ name: string; usage: number; rate: number }>;
    byCategory: Record<string, number>;
  } {
    let autoCreated = 0;
    const byCategory: Record<string, number> = {};
    const topSkills: Array<{ name: string; usage: number; rate: number }> = [];
    
    for (const skill of this.skills.values()) {
      if (skill.autoCreated) autoCreated++;
      byCategory[skill.category] = (byCategory[skill.category] || 0) + 1;
      topSkills.push({
        name: skill.name,
        usage: skill.usageCount,
        rate: skill.successRate,
      });
    }
    
    topSkills.sort((a, b) => b.usage - a.usage);
    
    return {
      total: this.skills.size,
      autoCreated,
      topSkills: topSkills.slice(0, 5),
      byCategory,
    };
  }
}

export const skillWeaver = new SkillWeaver();