import { client } from './client';
export const listRequests = async params => (await client.get('/requests', { params })).data;
export const getRequest = async id => (await client.get(`/requests/${id}`)).data;
export const createRequest = async data => (await client.post('/requests', data)).data;
export const decideRequest = async (id, decision, note) => (await client.post(`/requests/${id}/decision`, { decision, note })).data;
export const cancelRequest = async id => (await client.post(`/requests/${id}/cancel`)).data;
