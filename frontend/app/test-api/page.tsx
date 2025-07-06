'use client';

import { useState } from 'react';
import axios from 'axios';

export default function TestAPI() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const testHealth = async () => {
    try {
      const response = await axios.get('http://localhost:3501/health');
      setResult(response.data);
      setError('');
    } catch (err: any) {
      setError(err.message);
      setResult(null);
    }
  };

  const testCORS = async () => {
    try {
      const response = await axios.post(
        'http://localhost:3501/api/test-cors',
        { test: 'data' },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      setResult(response.data);
      setError('');
    } catch (err: any) {
      setError(err.message);
      setResult(null);
    }
  };

  const testAuth = async () => {
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/microsoft`,
        { token: 'test-token' },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      setResult(response.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data || err.message);
      setResult(null);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">API Test Page</h1>
      
      <div className="space-y-4">
        <div>
          <button
            onClick={testHealth}
            className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
          >
            Test Health Endpoint
          </button>
          <button
            onClick={testCORS}
            className="bg-green-500 text-white px-4 py-2 rounded mr-2"
          >
            Test CORS
          </button>
          <button
            onClick={testAuth}
            className="bg-purple-500 text-white px-4 py-2 rounded"
          >
            Test Auth Endpoint
          </button>
        </div>

        <div className="mt-4">
          <p>API URL: {process.env.NEXT_PUBLIC_API_URL}</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            Error: {JSON.stringify(error, null, 2)}
          </div>
        )}

        {result && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}