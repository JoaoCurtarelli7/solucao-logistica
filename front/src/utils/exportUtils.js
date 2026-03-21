import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'   // 👈 esta é a linha correta
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import dayjs from 'dayjs'
import { createStandardPdf, addCompactTable } from './pdfTheme'

// Verificar se jsPDF está disponível
if (typeof window !== 'undefined' && !window.jsPDF) {
  console.warn('jsPDF não está disponível no window')
}


// Função para extrair valor de dados aninhados
const getNestedValue = (obj, path) => {
  if (typeof path === 'string') {
    return obj[path] || ''
  }
  if (Array.isArray(path)) {
    return path.reduce((current, key) => {
      return current && current[key] ? current[key] : ''
    }, obj) || ''
  }
  return ''
}

// Função para formatar valor monetário
const formatCurrency = (value) => {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  } catch (error) {
    return 'R$ 0,00'
  }
}

// Função para formatar data
const formatDate = (date) => {
  try {
    if (!date) return 'N/A'
    const d = dayjs(date)
    if (!d.isValid()) return 'N/A'
    return d.format('DD/MM/YYYY')
  } catch (error) {
    return 'N/A'
  }
}

// Função para exportar relatório em PDF
export const exportToPDF = (data, columns, title, filename) => {
  try {
    // Verificar se jsPDF está disponível
    if (typeof jsPDF === 'undefined') {
      throw new Error('jsPDF não está disponível. Verifique se a biblioteca está instalada.')
    }

    const { doc } = createStandardPdf({
      title,
      subtitle: `Total de registros: ${data ? data.length : 0}`,
    })

    // Verificar se há dados
    if (!data || data.length === 0) {
      doc.setFontSize(12)
      doc.text('Nenhum dado encontrado para este relatório.', 14, 50)
    } else {
      // Preparar dados para a tabela
      const tableData = data.map(item => {
        return columns.map(col => {
          try {
            // Extrair valor baseado no dataIndex
            let rawValue = getNestedValue(item, col.dataIndex)

            // Aplicar render customizado se existir
            let value = typeof col.render === 'function' ? col.render(rawValue, item) : rawValue

            // Normalizar objetos/arrays para texto amigável
            if (Array.isArray(value)) {
              value = value.length
            } else if (value && typeof value === 'object') {
              value = JSON.stringify(value)
            }

            // Aplicar formatação apenas se NÃO houver render customizado
            if (!col.render) {
              if (col.title.includes('Valor') || col.title.includes('Salário') || col.title.includes('Custo') || col.title.includes('Total')) {
                value = formatCurrency(value)
              } else if (col.title.includes('Data')) {
                value = formatDate(value)
              } else if (col.title.includes('Status')) {
                value = value || 'N/A'
              } else if (col.title.includes('Peso')) {
                value = `${value || 0} kg`
              }
            }

            return value ?? ''
          } catch (error) {
            console.warn('Erro ao processar coluna:', col.title, error)
            return ''
          }
        })
      })

      const tableColumns = columns.map(col => col.title)

      // Adicionar tabela
      addCompactTable(doc, { head: tableColumns, body: tableData, startY: 45 })
    }

    // Rodapé
    const finalY = (doc.lastAutoTable?.finalY ?? 50) + 10
    doc.setFontSize(8)
    doc.text('Solução Logística - Relatórios', 14, finalY)
    doc.text(`Página ${typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : (doc.internal && typeof doc.internal.getNumberOfPages === 'function' ? doc.internal.getNumberOfPages() : 1)}`, 180, finalY)

    // Salvar arquivo
    const fileName = `${filename}_${dayjs().format('YYYY-MM-DD_HH-mm')}.pdf`
    doc.save(fileName)
  } catch (error) {
    console.error('Erro ao gerar PDF:', error)
    console.error('Stack trace:', error.stack)
    throw new Error(`Erro ao gerar arquivo PDF: ${error.message}`)
  }
}

// Função para exportar relatório em Excel
export const exportToExcel = (data, columns, title, filename) => {
  try {
    // Verificar se há dados
    if (!data || data.length === 0) {
      // Criar workbook com mensagem de "sem dados"
      const wb = XLSX.utils.book_new()
      const infoData = [
        ['Relatório:', title],
        ['Gerado em:', dayjs().format('DD/MM/YYYY HH:mm')],
        ['Total de registros:', 0],
        [''],
        ['Status:', 'Nenhum dado encontrado para este relatório.']
      ]

      const infoSheet = XLSX.utils.aoa_to_sheet(infoData)
      XLSX.utils.book_append_sheet(wb, infoSheet, 'Informações')

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

      saveAs(blob, `${filename}_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`)
      return
    }

    // Preparar dados para o Excel
    const excelData = data.map(item => {
      const row = {}
      columns.forEach(col => {
        try {
          // Extrair valor baseado no dataIndex
          let rawValue = getNestedValue(item, col.dataIndex)

          // Aplicar render customizado se existir
          let value = typeof col.render === 'function' ? col.render(rawValue, item) : rawValue

          // Normalizar objetos/arrays para texto amigável
          if (Array.isArray(value)) {
            value = value.length
          } else if (value && typeof value === 'object') {
            value = JSON.stringify(value)
          }

          // Aplicar formatação apenas se NÃO houver render customizado
          if (!col.render) {
            if (col.title.includes('Valor') || col.title.includes('Salário') || col.title.includes('Custo') || col.title.includes('Total')) {
              value = formatCurrency(value)
            } else if (col.title.includes('Data')) {
              value = formatDate(value)
            } else if (col.title.includes('Status')) {
              value = value || 'N/A'
            } else if (col.title.includes('Peso')) {
              value = `${value || 0} kg`
            }
          }

          row[col.title] = value ?? ''
        } catch (error) {
          console.warn('Erro ao processar coluna:', col.title, error)
          row[col.title] = ''
        }
      })
      return row
    })

    // Criar workbook
    const wb = XLSX.utils.book_new()

    // Adicionar informações do relatório
    const infoData = [
      ['Relatório:', title],
      ['Gerado em:', dayjs().format('DD/MM/YYYY HH:mm')],
      ['Total de registros:', data.length],
      [''],
      ['Dados do Relatório:']
    ]

    const infoSheet = XLSX.utils.aoa_to_sheet(infoData)
    XLSX.utils.book_append_sheet(wb, infoSheet, 'Informações')

    // Adicionar dados principais
    const dataSheet = XLSX.utils.json_to_sheet(excelData)

    // Ajustar largura das colunas
    const colWidths = columns.map(() => ({ wch: 20 }))
    dataSheet['!cols'] = colWidths

    XLSX.utils.book_append_sheet(wb, dataSheet, 'Dados')

    // Gerar arquivo Excel
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    saveAs(blob, `${filename}_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`)
  } catch (error) {
    console.error('Erro ao gerar Excel:', error)
    throw new Error('Erro ao gerar arquivo Excel')
  }
}

// Função para exportar relatório de funcionários
export const exportEmployeeReport = (data, format) => {
  const columns = [
    { title: 'Nome', dataIndex: 'name' },
    { title: 'CPF', dataIndex: 'cpf' },
    { title: 'Cargo', dataIndex: 'role' },
    {
      title: 'Status', dataIndex: 'status',
      render: (status) => status || 'N/A'
    },
    {
      title: 'Salário Base', dataIndex: 'baseSalary',
      render: (value) => {
        try {
          return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(value || 0)
        } catch (error) {
          return 'R$ 0,00'
        }
      }
    },
    {
      title: 'Data Contratação', dataIndex: 'hireDate',
      render: (date) => {
        try {
          return date ? dayjs(date).format('DD/MM/YYYY') : 'N/A'
        } catch (error) {
          return 'N/A'
        }
      }
    }
  ]

  if (format === 'pdf') {
    exportToPDF(data, columns, 'Relatório de Funcionários', 'funcionarios')
  } else if (format === 'excel') {
    exportToExcel(data, columns, 'Relatório de Funcionários', 'funcionarios')
  }
}

// Função para exportar relatório de empresas
export const exportCompanyReport = (data, format) => {
  const columns = [
    { title: 'Nome', dataIndex: 'name' },
    { title: 'CNPJ', dataIndex: 'cnpj' },
    {
      title: 'Status', dataIndex: 'status',
      render: (status) => status
    },
    {
      title: 'Cargas', dataIndex: 'loads',
      render: (loads) => loads?.length || 0
    },
    {
      title: 'Data Criação', dataIndex: 'dateRegistration',
      render: (_, record) => {
        return record.dateRegistration ? dayjs(record.dateRegistration).format('DD/MM/YYYY') : '- - -'}
    }
  ]

  if (format === 'pdf') {
    exportToPDF(data, columns, 'Relatório de Empresas', 'empresas')
  } else if (format === 'excel') {
    exportToExcel(data, columns, 'Relatório de Empresas', 'empresas')
  }
}

// Função para exportar relatório de cargas
export const exportLoadsReport = (data, format) => {
  const columns = [
    { title: 'Número da Carga', dataIndex: 'loadingNumber' },
    { 
      title: 'Empresa', 
      dataIndex: ['Company', 'name'],
      render: (name, record) => record.Company?.name || 'N/A'
    },
    { title: 'Entregas', dataIndex: 'deliveries' },
    { title: 'Peso (kg)', dataIndex: 'cargoWeight' },
    { title: 'Valor Total', dataIndex: 'totalValue' },
    { title: 'Data', dataIndex: 'date' }
  ]

  if (format === 'pdf') {
    exportToPDF(data, columns, 'Relatório de Cargas', 'cargas')
  } else if (format === 'excel') {
    exportToExcel(data, columns, 'Relatório de Cargas', 'cargas')
  }
}

// Função para exportar relatório de manutenções
export const exportMaintenanceReport = (data, format) => {
  const columns = [
    { title: 'Serviço', dataIndex: 'service' },
    { 
      title: 'Caminhão', 
      dataIndex: ['Truck', 'plate'],
      render: (plate, record) => record.Truck?.plate || 'N/A'
    },
    { title: 'Data', dataIndex: 'date' },
    { title: 'Valor', dataIndex: 'value' },
    { title: 'KM', dataIndex: 'km' }
  ]

  if (format === 'pdf') {
    exportToPDF(data, columns, 'Relatório de Manutenções', 'manutencoes')
  } else if (format === 'excel') {
    exportToExcel(data, columns, 'Relatório de Manutenções', 'manutencoes')
  }
}

// Função para exportar relatório financeiro
export const exportFinancialReport = (data, format) => {
  const columns = [
    { title: 'Data', dataIndex: 'date' },
    { title: 'Tipo', dataIndex: 'type' },
    { title: 'Valor', dataIndex: 'amount' },
    { 
      title: 'Funcionário', 
      dataIndex: ['Employee', 'name'],
      render: (name, record) => record.Employee?.name || 'N/A'
    }
  ]

  if (format === 'pdf') {
    exportToPDF(data, columns, 'Relatório Financeiro', 'financeiro')
  } else if (format === 'excel') {
    exportToExcel(data, columns, 'Relatório Financeiro', 'financeiro')
  }
}

// Função para exportar relatório de viagens
export const exportTripsReport = (data, format) => {
  const columns = [
    { title: 'Destino', dataIndex: 'destination' },
    { title: 'Motorista', dataIndex: 'driver' },
    { 
      title: 'Caminhão', 
      dataIndex: ['Truck', 'plate'],
      render: (plate, record) => record.Truck?.plate || 'N/A'
    },
    { title: 'Status', dataIndex: 'status' },
    { title: 'Data', dataIndex: 'date' }
  ]

  if (format === 'pdf') {
    exportToPDF(data, columns, 'Relatório de Viagens', 'viagens')
  } else if (format === 'excel') {
    exportToExcel(data, columns, 'Relatório de Viagens', 'viagens')
  }
}
