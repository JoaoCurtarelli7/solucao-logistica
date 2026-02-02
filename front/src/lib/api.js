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

// Intercepta as respostas para lidar com erros de token expirado
api.interceptors.response.use(
  (response) => {
    return response // Retorna a resposta se não houver erro
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expirado ou inválido
      localStorage.removeItem('token') // Remove o token do localStorage
      message.error('Sua sessão expirou. Faça login novamente.')

      // Redireciona para login usando window.location
      window.location.href = '/login'
    }

    return Promise.reject(error)
  },
)

export default api
