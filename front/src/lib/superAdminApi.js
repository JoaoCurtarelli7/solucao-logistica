import axios from 'axios'

const superAdminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3333',
})

superAdminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('superadmin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

superAdminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/login')
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('superadmin_token')
      window.location.href = '/super-admin/login'
    }
    return Promise.reject(error)
  },
)

export default superAdminApi
