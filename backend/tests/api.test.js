const request = require('supertest');
const app = require('../server');

describe('Prospects API', () => {
  test('GET /api/prospects returns array', async () => {
    const res = await request(app).get('/api/prospects');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /api/prospects?icp_min=85 filters by ICP', async () => {
    const res = await request(app).get('/api/prospects?icp_min=85');
    expect(res.status).toBe(200);
    res.body.forEach(p => expect(p.icp_score).toBeGreaterThanOrEqual(85));
  });

  test('GET /api/prospects/:id returns single prospect', async () => {
    const res = await request(app).get('/api/prospects/1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('icp_score');
  });

  test('GET /api/prospects/sectors returns sector counts', async () => {
    const res = await request(app).get('/api/prospects/sectors');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Pipeline API', () => {
  let pipelineId;
  test('POST /api/pipeline adds entry', async () => {
    const res = await request(app).post('/api/pipeline').send({ prospect_id: 1, company_name: 'Test Co', stage: 'new' });
    expect(res.status).toBe(201);
    pipelineId = res.body.id;
  });

  test('PUT /api/pipeline/:id updates stage', async () => {
    const res = await request(app).put(`/api/pipeline/${pipelineId}`).send({ stage: 'called' });
    expect(res.status).toBe(200);
  });

  test('DELETE /api/pipeline/:id removes entry', async () => {
    const res = await request(app).delete(`/api/pipeline/${pipelineId}`);
    expect(res.status).toBe(200);
  });
});
