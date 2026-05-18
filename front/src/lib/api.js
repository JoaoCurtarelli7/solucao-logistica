import axios from 'axios'
import { message } from 'antd'

// Usa URL da API vinda de env em produção e localhost no desenvolvimento
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3333',
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') // Busca o token salvo no navegador

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Intercepta as respostas para lidar com erros globais
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/login')
    const status = error.response?.status
    const code = error.response?.data?.code

    if (status === 401 && !isLoginRequest) {
      localStorage.removeItem('token')
      message.error('Sua sessão expirou. Faça login novamente.')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (status === 402 || code === 'PLAN_EXPIRED') {
      message.error({
        content: 'Seu plano expirou. Entre em contato com o administrador para renovar o acesso.',
        duration: 8,
      })
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (status === 403 && code === 'ACCOUNT_SUSPENDED') {
      message.error({
        content: 'Conta suspensa. Entre em contato com o suporte.',
        duration: 8,
      })
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    return Promise.reject(error)
  },
)

export default api
