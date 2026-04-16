import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '10s',
};

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZGU2OGI4MTUzNzc1NjVmMWM0MjBhMCIsInJvbGUiOiJBRE1JTiIsInVzZXJOYW1lIjoiTW9oYW1lZCIsIm9mZmljZUlkIjoiNjlkZTY4YjcxNTM3NzU2NWYxYzQyMDlkIiwiaWF0IjoxNzc2MzM3NzIwLCJleHAiOjE3NzY1OTY5MjAsImp0aSI6ImRlM2RlODAyLTM2MjktNDBiYS1hYTJhLTE5MjNlMTE3OTljNyJ9.ue9i1YSLK35ZW9hKac4FVjd7KTJBho9765qXuTa24bk';
const invoiceId = '69e0c4817801e82c7a75b056'; // مثال من اللي اتعملوا عندك

export default function () {
  const url = `http://localhost:5000/invoices/${invoiceId}/print`;

  const res = http.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'content-type is pdf': (r) =>
      String(r.headers['Content-Type'] || '').includes('application/pdf'),
  });

  console.log(`status=${res.status} time=${res.timings.duration}ms`);
  sleep(1);
}