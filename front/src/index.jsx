import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import ptBR from 'antd/es/locale/pt_BR'
import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'
import AppRoutes from './routes'
import 'bootstrap/dist/css/bootstrap.min.css'

dayjs.locale('pt-br')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider locale={ptBR}>
      <AppRoutes />
    </ConfigProvider>
  </React.StrictMode>,
)
