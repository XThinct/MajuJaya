import { client } from './client';
export const listEmployees = async () => (await client.get('/employees')).data;
export const listActivity = async () => (await client.get('/activity')).data;
