import { PluginManifest } from './types';

export interface PluginTemplate {
  id: string;
  name: string;
  description: string;
  category: 'productivity' | 'utilities' | 'integration' | 'developer' | 'custom';
  icon: string;
  manifest: Partial<PluginManifest>;
  template: string;
}

export const PLUGIN_TEMPLATES: PluginTemplate[] = [
  {
    id: 'basic',
    name: 'Basic Plugin',
    description: 'A simple plugin with basic functionality',
    category: 'utilities',
    icon: '📦',
    manifest: {
      version: '1.0.0',
      main: 'index.js',
    },
    template: `export default {
  manifest: {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
  },
  async onInit() {
    console.log('Plugin initialized');
  },
};`,
  },
  {
    id: 'with-ui',
    name: 'Plugin with UI',
    description: 'A plugin with custom UI components',
    category: 'productivity',
    icon: '🎨',
    manifest: {
      version: '1.0.0',
      main: 'index.js',
    },
    template: `import { Panel } from '@timps/ui';

export default {
  manifest: {
    id: 'my-ui-plugin',
    name: 'My UI Plugin',
    version: '1.0.0',
  },
  render() {
    return (
      <Panel title="My Panel">
        <div>Hello from my plugin!</div>
      </Panel>
    );
  },
};`,
  },
  {
    id: 'with-api',
    name: 'Plugin with API',
    description: 'A plugin that makes HTTP requests',
    category: 'integration',
    icon: '🌐',
    manifest: {
      version: '1.0.0',
      main: 'index.js',
    },
    template: `export default {
  manifest: {
    id: 'my-api-plugin',
    name: 'My API Plugin',
    version: '1.0.0',
  },
  async onInit() {
    const response = await this.api.http.get('https://api.example.com/data');
    console.log(response);
  },
};`,
  },
  {
    id: 'with-storage',
    name: 'Plugin with Storage',
    description: 'A plugin that stores data persistently',
    category: 'utilities',
    icon: '💾',
    manifest: {
      version: '1.0.0',
      main: 'index.js',
    },
    template: `export default {
  manifest: {
    id: 'my-storage-plugin',
    name: 'My Storage Plugin',
    version: '1.0.0',
  },
  async onInit() {
    await this.storage.set('key', 'value');
    const value = await this.storage.get('key');
    console.log(value);
  },
};`,
  },
  {
    id: 'with-shortcuts',
    name: 'Plugin with Shortcuts',
    description: 'A plugin with keyboard shortcuts',
    category: 'productivity',
    icon: '⌨️',
    manifest: {
      version: '1.0.0',
      main: 'index.js',
    },
    template: `export default {
  manifest: {
    id: 'my-shortcuts-plugin',
    name: 'My Shortcuts Plugin',
    version: '1.0.0',
  },
  shortcuts: [
    {
      key: 'k',
      ctrl: true,
      action: () => console.log('Shortcut triggered'),
    },
  ],
};`,
  },
];

export class PluginTemplateManager {
  private templates: Map<string, PluginTemplate> = new Map();

  constructor() {
    PLUGIN_TEMPLATES.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  get(id: string): PluginTemplate | undefined {
    return this.templates.get(id);
  }

  getAll(): PluginTemplate[] {
    return Array.from(this.templates.values());
  }

  getByCategory(category: PluginTemplate['category']): PluginTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  add(template: PluginTemplate): void {
    this.templates.set(template.id, template);
  }

  remove(id: string): void {
    this.templates.delete(id);
  }

  createFromTemplate(templateId: string, options: { id: string; name: string }): string {
    const template = this.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    let code = template.template;
    code = code.replace(/my-plugin/g, options.id);
    code = code.replace(/My Plugin/g, options.name);

    return code;
  }
}

export default PluginTemplateManager;