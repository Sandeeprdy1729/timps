import { IntegrationBase } from './integration-base';

export interface ServiceNowIncident {
  sys_id: string;
  number: string;
  short_description: string;
  description: string;
  category: string;
  subcategory: string;
  impact: number;
  urgency: number;
  priority: number;
  state: string;
  assigned_to: string;
  assigned_group: string;
  caller_id: string;
  opened_by: string;
  resolved_by?: string;
  closed_by?: string;
  resolved_at?: string;
  closed_at?: string;
  due_date?: string;
  sys_created_on: string;
  sys_updated_on: string;
}

export interface ServiceNowChangeRequest {
  sys_id: string;
  number: string;
  short_description: string;
  description: string;
  type: string;
  category: string;
  subcategory: string;
  state: string;
  risk: string;
  phase: string;
  requested_by: string;
  requested_by_date: string;
  assigned_to: string;
  start_date: string;
  end_date: string;
  estimated_days: number;
  actual_days: number;
  sys_created_on: string;
  sys_updated_on: string;
}

export interface ServiceNowUser {
  sys_id: string;
  user_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  mobile_phone: string;
  department: string;
  location: string;
  manager: string;
  active: boolean;
  locked_out: boolean;
  sys_created_on: string;
  sys_updated_on: string;
}

export interface ServiceNowGroup {
  sys_id: string;
  name: string;
  description: string;
  active: boolean;
  email: string;
  manager: string;
  sys_created_on: string;
}

export interface ServiceNowTask {
  sys_id: string;
  task_number: string;
  short_description: string;
  description: string;
  state: string;
  assigned_to: string;
  assigned_group: string;
  active: boolean;
  sys_created_on: string;
  sys_updated_on: string;
}

export interface ServiceNowConfigurationItem {
  sys_id: string;
  name: string;
  sys_class_name: string;
  ip_address?: string;
  mac_address?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  assigned_to: string;
  location: string;
  install_status: string;
  sys_created_on: string;
}

export interface ServiceNowCMDB {
  sys_id: string;
  name: string;
  sys_class_name: string;
  sys_class_path: string;
  sys_mod_count: string;
  sys_tags: string;
}

export interface ServiceNowVariable {
  sys_id: string;
  question_text: string;
  answer: string;
  task: string;
}

export interface ServiceNowAttachment {
  sys_id: string;
  file_name: string;
  file_size: string;
  content_type: string;
  sys_created_on: string;
}

export interface ServiceNowKnowledge {
  sys_id: string;
  number: string;
  title: string;
  text: string;
  category: string;
  author: string;
  published: boolean;
  view_count: number;
}

interface ServiceNowConfig {
  instanceUrl: string;
  username: string;
  password: string;
}

export class ServiceNowPlugin extends IntegrationBase {
  private config: ServiceNowConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    super('ServiceNow', 'servicenow', 'IT service management integration');
    this.config = {} as ServiceNowConfig;
  }

  setConfig(instanceUrl: string, username: string, password: string): void {
    this.config = { instanceUrl, username, password };
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    };
  }

  private getBaseUrl(): string {
    return `${this.config.instanceUrl}/api/now/table`;
  }

  async apiCall<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    return this.makeRequest<T>(method, url, body, this.baseHeaders);
  }

  async query(table: string, query?: string): Promise<{ result: any[] }> {
    const params = query ? `?sysparm_query=${query}` : '';
    return this.apiCall<{ result: any[] }>('GET', `/${table}${params}`);
  }

  async getIncident(incidentSysId: string): Promise<{ result: ServiceNowIncident[] }> {
    return this.apiCall<{ result: ServiceNowIncident[] }>('GET', `/incident?sys_id=${incidentSysId}`);
  }

  async createIncident(incident: Partial<ServiceNowIncident>): Promise<{ result: ServiceNowIncident }> {
    const response = await this.apiCall<{ result: ServiceNowIncident[] }>('POST', '/incident', incident);
    return { result: response.result[0] };
  }

  async updateIncident(incidentSysId: string, updates: Partial<ServiceNowIncident>): Promise<{ result: ServiceNowIncident }> {
    const response = await this.apiCall<{ result: ServiceNowIncident[] }>('PATCH', `/incident?sys_id=${incidentSysId}`, updates);
    return { result: response.result[0] };
  }

  async deleteIncident(incidentSysId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/incident?sys_id=${incidentSysId}`);
  }

  async listIncidents(query?: string): Promise<{ result: ServiceNowIncident[] }> {
    return this.query('incident', query);
  }

  async getChangeRequest(changeSysId: string): Promise<{ result: ServiceNowChangeRequest[] }> {
    return this.apiCall<{ result: ServiceNowChangeRequest[] }>('GET', `/change_request?sys_id=${changeSysId}`);
  }

  async createChangeRequest(change: Partial<ServiceNowChangeRequest>): Promise<{ result: ServiceNowChangeRequest }> {
    const response = await this.apiCall<{ result: ServiceNowChangeRequest[] }>('POST', '/change_request', change);
    return { result: response.result[0] };
  }

  async updateChangeRequest(changeSysId: string, updates: Partial<ServiceNowChangeRequest>): Promise<{ result: ServiceNowChangeRequest }> {
    const response = await this.apiCall<{ result: ServiceNowChangeRequest[] }>('PATCH', `/change_request?sys_id=${changeSysId}`, updates);
    return { result: response.result[0] };
  }

  async approveChangeRequest(changeSysId: string): Promise<{ result: ServiceNowChangeRequest }> {
    return this.updateChangeRequest(changeSysId, { state: 'Approved' } as any);
  }

  async listChangeRequests(query?: string): Promise<{ result: ServiceNowChangeRequest[] }> {
    return this.query('change_request', query);
  }

  async getUser(userSysId: string): Promise<{ result: ServiceNowUser[] }> {
    return this.apiCall<{ result: ServiceNowUser[] }>('GET', `/sys_user?sys_id=${userSysId}`);
  }

  async createUser(user: Partial<ServiceNowUser>): Promise<{ result: ServiceNowUser }> {
    const response = await this.apiCall<{ result: ServiceNowUser[] }>('POST', '/sys_user', user);
    return { result: response.result[0] };
  }

  async updateUser(userSysId: string, updates: Partial<ServiceNowUser>): Promise<{ result: ServiceNowUser }> {
    const response = await this.apiCall<{ result: ServiceNowUser[] }>('PATCH', `/sys_user?sys_id=${userSysId}`, updates);
    return { result: response.result[0] };
  }

  async deleteUser(userSysId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/sys_user?sys_id=${userSysId}`);
  }

  async listUsers(query?: string): Promise<{ result: ServiceNowUser[] }> {
    return this.query('sys_user', query);
  }

  async getGroup(groupSysId: string): Promise<{ result: ServiceNowGroup[] }> {
    return this.apiCall<{ result: ServiceNowGroup[] }>('GET', `/sys_user_group?sys_id=${groupSysId}`);
  }

  async createGroup(group: Partial<ServiceNowGroup>): Promise<{ result: ServiceNowGroup }> {
    const response = await this.apiCall<{ result: ServiceNowGroup[] }>('POST', '/sys_user_group', group);
    return { result: response.result[0] };
  }

  async updateGroup(groupSysId: string, updates: Partial<ServiceNowGroup>): Promise<{ result: ServiceNowGroup }> {
    const response = await this.apiCall<{ result: ServiceNowGroup[] }>('PATCH', `/sys_user_group?sys_id=${groupSysId}`, updates);
    return { result: response.result[0] };
  }

  async deleteGroup(groupSysId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/sys_user_group?sys_id=${groupSysId}`);
  }

  async listGroups(query?: string): Promise<{ result: ServiceNowGroup[] }> {
    return this.query('sys_user_group', query);
  }

  async getTask(taskSysId: string): Promise<{ result: ServiceNowTask[] }> {
    return this.apiCall<{ result: ServiceNowTask[] }>('GET', `/task?sys_id=${taskSysId}`);
  }

  async listTasks(query?: string): Promise<{ result: ServiceNowTask[] }> {
    return this.query('task', query);
  }

  async getConfigurationItem(ciSysId: string): Promise<{ result: ServiceNowConfigurationItem[] }> {
    return this.apiCall<{ result: ServiceNowConfigurationItem[] }>('GET', `/cmdb_ci?sys_id=${ciSysId}`);
  }

  async createConfigurationItem(ci: Partial<ServiceNowConfigurationItem>): Promise<{ result: ServiceNowConfigurationItem }> {
    const response = await this.apiCall<{ result: ServiceNowConfigurationItem[] }>('POST', '/cmdb_ci', ci);
    return { result: response.result[0] };
  }

  async updateConfigurationItem(ciSysId: string, updates: Partial<ServiceNowConfigurationItem>): Promise<{ result: ServiceNowConfigurationItem }> {
    const response = await this.apiCall<{ result: ServiceNowConfigurationItem[] }>('PATCH', `/cmdb_ci?sys_id=${ciSysId}`, updates);
    return { result: response.result[0] };
  }

  async deleteConfigurationItem(ciSysId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/cmdb_ci?sys_id=${ciSysId}`);
  }

  async listConfigurationItems(query?: string): Promise<{ result: ServiceNowConfigurationItem[] }> {
    return this.query('cmdb_ci', query);
  }

  async getVariable(variableSysId: string): Promise<{ result: ServiceNowVariable[] }> {
    return this.apiCall<{ result: ServiceNowVariable[] }>('GET', `/item_option_new?sys_id=${variableSysId}`);
  }

  async listVariables(taskSysId: string): Promise<{ result: ServiceNowVariable[] }> {
    return this.query('item_option_new', `task=${taskSysId}`);
  }

  async getAttachment(attachmentSysId: string): Promise<{ result: ServiceNowAttachment[] }> {
    return this.apiCall<{ result: ServiceNowAttachment[] }>('GET', `/sys_attachment?sys_id=${attachmentSysId}`);
  }

  async createAttachment(tableName: string, recordSysId: string, fileName: string, content: string, contentType: string): Promise<{ result: ServiceNowAttachment }> {
    return this.apiCall<{ result: ServiceNowAttachment }>('POST', `/sys_attachment`, {
      table_name: tableName,
      record_sys_id: recordSysId,
      file_name: fileName,
      content: Buffer.from(content).toString('base64'),
      content_type: contentType,
    });
  }

  async listAttachments(tableName: string, recordSysId: string): Promise<{ result: ServiceNowAttachment[] }> {
    return this.query('sys_attachment', `table_name=${tableName}^record_id=${recordSysId}`);
  }

  async getKnowledge(knowledgeSysId: string): Promise<{ result: ServiceNowKnowledge[] }> {
    return this.apiCall<{ result: ServiceNowKnowledge[] }>('GET', `/kb_knowledge?sys_id=${knowledgeSysId}`);
  }

  async createKnowledge(knowledge: Partial<ServiceNowKnowledge>): Promise<{ result: ServiceNowKnowledge }> {
    const response = await this.apiCall<{ result: ServiceNowKnowledge[] }>('POST', '/kb_knowledge', knowledge);
    return { result: response.result[0] };
  }

  async updateKnowledge(knowledgeSysId: string, updates: Partial<ServiceNowKnowledge>): Promise<{ result: ServiceNowKnowledge }> {
    const response = await this.apiCall<{ result: ServiceNowKnowledge[] }>('PATCH', `/kb_knowledge?sys_id=${knowledgeSysId}`, updates);
    return { result: response.result[0] };
  }

  async publishKnowledge(knowledgeSysId: string): Promise<{ result: ServiceNowKnowledge }> {
    return this.updateKnowledge(knowledgeSysId, { published: true } as any);
  }

  async deleteKnowledge(knowledgeSysId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/kb_knowledge?sys_id=${knowledgeSysId}`);
  }

  async listKnowledge(query?: string): Promise<{ result: ServiceNowKnowledge[] }> {
    return this.query('kb_knowledge', query);
  }

  getManifest() {
    return {
      name: 'ServiceNow',
      id: 'servicenow',
      description: 'IT service management integration',
      version: '1.0.0',
      actions: [
        { id: 'get_incident', name: 'Get Incident', description: 'Get incident details' },
        { id: 'create_incident', name: 'Create Incident', description: 'Create a new incident' },
        { id: 'update_incident', name: 'Update Incident', description: 'Update an incident' },
        { id: 'delete_incident', name: 'Delete Incident', description: 'Delete an incident' },
        { id: 'list_incidents', name: 'List Incidents', description: 'List all incidents' },
        { id: 'get_change_request', name: 'Get Change Request', description: 'Get change request details' },
        { id: 'create_change_request', name: 'Create Change Request', description: 'Create a change request' },
        { id: 'update_change_request', name: 'Update Change Request', description: 'Update change request' },
        { id: 'approve_change_request', name: 'Approve Change Request', description: 'Approve a change request' },
        { id: 'list_change_requests', name: 'List Change Requests', description: 'List change requests' },
        { id: 'get_user', name: 'Get User', description: 'Get user details' },
        { id: 'create_user', name: 'Create User', description: 'Create a new user' },
        { id: 'update_user', name: 'Update User', description: 'Update user' },
        { id: 'delete_user', name: 'Delete User', description: 'Delete a user' },
        { id: 'list_users', name: 'List Users', description: 'List all users' },
        { id: 'get_group', name: 'Get Group', description: 'Get group details' },
        { id: 'create_group', name: 'Create Group', description: 'Create a new group' },
        { id: 'update_group', name: 'Update Group', description: 'Update group' },
        { id: 'delete_group', name: 'Delete Group', description: 'Delete a group' },
        { id: 'list_groups', name: 'List Groups', description: 'List all groups' },
        { id: 'get_task', name: 'Get Task', description: 'Get task details' },
        { id: 'list_tasks', name: 'List Tasks', description: 'List all tasks' },
        { id: 'get_configuration_item', name: 'Get Configuration Item', description: 'Get CI details' },
        { id: 'create_configuration_item', name: 'Create Configuration Item', description: 'Create a CI' },
        { id: 'update_configuration_item', name: 'Update Configuration Item', description: 'Update CI' },
        { id: 'delete_configuration_item', name: 'Delete Configuration Item', description: 'Delete a CI' },
        { id: 'list_configuration_items', name: 'List Configuration Items', description: 'List all CIs' },
        { id: 'get_variable', name: 'Get Variable', description: 'Get variable details' },
        { id: 'list_variables', name: 'List Variables', description: 'List variables for task' },
        { id: 'get_attachment', name: 'Get Attachment', description: 'Get attachment details' },
        { id: 'create_attachment', name: 'Create Attachment', description: 'Create an attachment' },
        { id: 'list_attachments', name: 'List Attachments', description: 'List attachments' },
        { id: 'get_knowledge', name: 'Get Knowledge', description: 'Get knowledge article' },
        { id: 'create_knowledge', name: 'Create Knowledge', description: 'Create knowledge article' },
        { id: 'update_knowledge', name: 'Update Knowledge', description: 'Update knowledge article' },
        { id: 'publish_knowledge', name: 'Publish Knowledge', description: 'Publish knowledge article' },
        { id: 'delete_knowledge', name: 'Delete Knowledge', description: 'Delete knowledge article' },
        { id: 'list_knowledge', name: 'List Knowledge', description: 'List knowledge articles' },
      ],
      triggers: [
        { id: 'incident_created', name: 'Incident Created', description: 'Triggered when incident is created' },
        { id: 'incident_updated', name: 'Incident Updated', description: 'Triggered when incident is updated' },
        { id: 'incident_resolved', name: 'Incident Resolved', description: 'Triggered when incident is resolved' },
        { id: 'change_created', name: 'Change Created', description: 'Triggered when change request is created' },
        { id: 'change_updated', name: 'Change Updated', description: 'Triggered when change request is updated' },
        { id: 'change_approved', name: 'Change Approved', description: 'Triggered when change request is approved' },
        { id: 'task_assigned', name: 'Task Assigned', description: 'Triggered when task is assigned' },
        { id: 'ci_updated', name: 'CI Updated', description: 'Triggered when CI is updated' },
      ],
      auth: {
        type: 'basic',
        fields: [
          { name: 'instanceUrl', label: 'Instance URL', description: 'Your ServiceNow instance URL', required: true },
          { name: 'username', label: 'Username', description: 'ServiceNow username', required: true },
          { name: 'password', label: 'Password', description: 'ServiceNow password', required: true },
        ],
      },
      connectionTest: {
        endpoint: '/incident',
        method: 'GET',
      },
    };
  }
}

export const servicenowPlugin = new ServiceNowPlugin();