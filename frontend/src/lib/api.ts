import axios from 'axios';

// Create an Axios instance with base URL and default headers
export const api = axios.create({
    baseURL: 'http://localhost:8000/api', // Make sure this matches your Django backend URL
    headers: {
        'Content-Type': 'application/json',
    },
});

// Response interceptor to handle common errors (optional but recommended)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.response || error.message);
        return Promise.reject(error);
    }
);
