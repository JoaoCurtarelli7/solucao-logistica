import * as Sentry from '@sentry/react'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import ptBR from 'antd/es/locale/pt_BR'
import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'
import AppRoutes from './routes'
import 'bootstrap/dist/css/bootstrap.min.css'

dayjs.locale('pt-br')

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Algo deu errado. Já fomos notificados.</p>}>
      <ConfigProvider locale={ptBR}>
        <AppRoutes />
      </ConfigProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
