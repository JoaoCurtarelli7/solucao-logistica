import React, { useState, useEffect } from 'react'
import {
    Card,
    Row,
    Col,
    Form,
    Input,
    Button,
    Typography,
    message, Divider,
    Statistic,
    Space,
    Alert,
    Spin,
    Tag
} from 'antd'
import {
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
    HomeOutlined,
    CalendarOutlined,
    EditOutlined,
    SaveOutlined,
    CloseOutlined,
    LockOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined
} from '@ant-design/icons'
import { useUserContext } from '../../context/userContext'
import api from '../../lib/api'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography

export default function UserProfile() {
  const { user, setUser, loading: userLoading, refreshUser } = useUserContext()
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [userStats, setUserStats] = useState(null)

  // Carregar dados do usuário se não estiver carregado
  useEffect(() => {
    if (!user && !userLoading) {
      refreshUser()
    }
  }, [user, userLoading, refreshUser])

  // Carregar dados do usuário
  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        address: user.address || ''
      })
    }
  }, [user, form])

  // Carregar estatísticas do usuário
  useEffect(() => {
    if (user) {
      loadUserStats()
    }
  }, [user])

  const loadUserStats = async () => {
    try {
      const response = await api.get('/me/stats')
      setUserStats(response.data)
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
    form.setFieldsValue({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      address: user?.address || ''
    })
  }

  const handleCancel = () => {
    setIsEditing(false)
    form.resetFields()
  }

  const handleSave = async (values) => {
    try {
      setLoading(true)
      const response = await api.put('/me', values)
      
      // Atualizar dados do usuário no contexto
      setUser(response.data.user)
      
      message.success(response.data.message || 'Perfil atualizado com sucesso!')
      setIsEditing(false)
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error)
      if (error.response?.data?.message) {
        message.error(error.response.data.message)
      } else {
        message.error('Erro ao atualizar perfil. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (values) => {
    try {
      setPasswordLoading(true)
      const response = await api.patch('/me/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      })
      
      message.success(response.data.message || 'Senha alterada com sucesso!')
      passwordForm.resetFields()
      setIsChangingPassword(false)
    } catch (error) {
      console.error('Erro ao alterar senha:', error)
      if (error.response?.data?.message) {
        message.error(error.response.data.message)
      } else {
        message.error('Erro ao alterar senha. Tente novamente.')
      }
    } finally {
      setPasswordLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Não informado'
    return dayjs(dateString).format('DD/MM/YYYY HH:mm')
  }

  if (userLoading || !user) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '20px' }}>Carregando perfil...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <Title level={2} style={{ textAlign: 'center', marginBottom: '30px', color: '#1890ff' }}>
        👤 Perfil do Usuário
      </Title>

      <Row gutter={[24, 24]}>
        {/* Informações do Usuário */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <UserOutlined />
                <span>Informações do Perfil</span>
              </Space>
            }
            extra={
              !isEditing && (
                <Button 
                  type="primary" 
                  icon={<EditOutlined />}
                  onClick={handleEdit}
                >
                  Editar Perfil
                </Button>
              )
            }
            style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          >
            {isEditing ? (
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                initialValues={{
                  name: user.name,
                  email: user.email,
                  phone: user.phone || '',
                  address: user.address || ''
                }}
              >
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Nome Completo"
                      name="name"
                      rules={[
                        { required: true, message: 'Por favor, insira seu nome!' },
                        { min: 2, message: 'Nome deve ter pelo menos 2 caracteres!' }
                      ]}
                    >
                      <Input 
                        prefix={<UserOutlined />}
                        placeholder="Seu nome completo"
                        size="large"
                      />
                    </Form.Item>
                  </Col>
                  
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Email"
                      name="email"
                      rules={[
                        { required: true, message: 'Por favor, insira seu email!' },
                        { type: 'email', message: 'Insira um email válido!' }
                      ]}
                    >
                      <Input 
                        prefix={<MailOutlined />}
                        placeholder="seu@email.com"
                        size="large"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Telefone"
                      name="phone"
                    >
                      <Input 
                        prefix={<PhoneOutlined />}
                        placeholder="(11) 99999-9999"
                        size="large"
                      />
                    </Form.Item>
                  </Col>
                  
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Endereço"
                      name="address"
                    >
                      <Input 
                        prefix={<HomeOutlined />}
                        placeholder="Seu endereço completo"
                        size="large"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider />

                <Row gutter={[16, 16]}>
                  <Col>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<SaveOutlined />}
                      loading={loading}
                      size="large"
                      style={{ borderRadius: '8px' }}
                    >
                      Salvar Alterações
                    </Button>
                  </Col>
                  <Col>
                    <Button
                      onClick={handleCancel}
                      icon={<CloseOutlined />}
                      size="large"
                      style={{ borderRadius: '8px' }}
                    >
                      Cancelar
                    </Button>
                  </Col>
                </Row>
              </Form>
            ) : (
              <div>
                <Row gutter={[24, 16]}>
                  <Col xs={24} sm={12}>
                    <div style={{ marginBottom: '20px' }}>
                      <Text strong style={{ fontSize: '16px' }}>Nome Completo:</Text>
                      <br />
                      <Text style={{ fontSize: '18px' }}>{user.name}</Text>
                    </div>
                    
                    <div style={{ marginBottom: '20px' }}>
                      <Text strong style={{ fontSize: '16px' }}>Email:</Text>
                      <br />
                      <Text style={{ fontSize: '18px' }}>{user.email}</Text>
                    </div>
                  </Col>
                  
                  <Col xs={24} sm={12}>
                    <div style={{ marginBottom: '20px' }}>
                      <Text strong style={{ fontSize: '16px' }}>Telefone:</Text>
                      <br />
                      <Text style={{ fontSize: '18px' }}>
                        {user.phone ? user.phone : 'Não informado'}
                      </Text>
                    </div>
                    
                    <div style={{ marginBottom: '20px' }}>
                      <Text strong style={{ fontSize: '16px' }}>Endereço:</Text>
                      <br />
                      <Text style={{ fontSize: '18px' }}>
                        {user.address ? user.address : 'Não informado'}
                      </Text>
                    </div>
                  </Col>
                </Row>

                <Divider />

                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Membro desde"
                      value={formatDate(user.createdAt)}
                      prefix={<CalendarOutlined />}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Status"
                      value="Ativo"
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="Tipo de Conta"
                      value="Usuário"
                      valueStyle={{ color: '#1890ff' }}
                      prefix={<UserOutlined />}
                    />
                  </Col>
                </Row>
              </div>
            )}
          </Card>
        </Col>

        {/* Alterar Senha */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <LockOutlined />
                <span>Segurança</span>
              </Space>
            }
            style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          >
            {isChangingPassword ? (
              <Form
                form={passwordForm}
                layout="vertical"
                onFinish={handleChangePassword}
              >
                <Form.Item
                  label="Senha Atual"
                  name="currentPassword"
                  rules={[
                    { required: true, message: 'Por favor, insira sua senha atual!' }
                  ]}
                >
                  <Input.Password 
                    placeholder="Sua senha atual"
                    size="large"
                  />
                </Form.Item>

                <Form.Item
                  label="Nova Senha"
                  name="newPassword"
                  rules={[
                    { required: true, message: 'Por favor, insira a nova senha!' },
                    { min: 6, message: 'A senha deve ter pelo menos 6 caracteres!' }
                  ]}
                >
                  <Input.Password 
                    placeholder="Nova senha"
                    size="large"
                  />
                </Form.Item>

                <Form.Item
                  label="Confirmar Nova Senha"
                  name="confirmPassword"
                  dependencies={['newPassword']}
                  rules={[
                    { required: true, message: 'Por favor, confirme a nova senha!' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('newPassword') === value) {
                          return Promise.resolve()
                        }
                        return Promise.reject(new Error('As senhas não correspondem!'))
                      },
                    }),
                  ]}
                >
                  <Input.Password 
                    placeholder="Confirme a nova senha"
                    size="large"
                  />
                </Form.Item>

                <Row gutter={[16, 16]}>
                  <Col>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={passwordLoading}
                      size="large"
                      style={{ borderRadius: '8px' }}
                    >
                      Alterar Senha
                    </Button>
                  </Col>
                  <Col>
                    <Button
                      onClick={() => setIsChangingPassword(false)}
                      size="large"
                      style={{ borderRadius: '8px' }}
                    >
                      Cancelar
                    </Button>
                  </Col>
                </Row>
              </Form>
            ) : (
              <div>
                <Alert
                  message="Segurança da Conta"
                  description="Mantenha sua senha segura e única. Recomendamos alterá-la regularmente."
                  type="info"
                  showIcon
                  style={{ marginBottom: '20px' }}
                />
                
                <Button
                  type="primary"
                  icon={<LockOutlined />}
                  onClick={() => setIsChangingPassword(true)}
                  size="large"
                  style={{ borderRadius: '8px', width: '100%' }}
                >
                  Alterar Senha
                </Button>
              </div>
            )}
          </Card>

          {/* Estatísticas do Usuário */}
          {userStats && (
            <Card
              title={
                <Space>
                  <InfoCircleOutlined />
                  <span>Estatísticas</span>
                </Space>
              }
              style={{ 
                borderRadius: '12px', 
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                marginTop: '24px'
              }}
            >
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic
                    title="Último Login"
                    value={formatDate(userStats.lastLogin)}
                    valueStyle={{ fontSize: '14px' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Perfil Atualizado"
                    value={userStats.profileUpdated ? 'Sim' : 'Não'}
                    valueStyle={{ 
                      fontSize: '14px',
                      color: userStats.profileUpdated ? '#52c41a' : '#ff4d4f'
                    }}
                  />
                </Col>
              </Row>
            </Card>
          )}
        </Col>
      </Row>

      {/* Informações Adicionais */}
      <Row style={{ marginTop: '24px' }}>
        <Col span={24}>
          <Card
            title="Informações do Sistema"
            style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          >
            <Row gutter={[24, 16]}>
              <Col xs={24} sm={8}>
                <Tag color="blue" icon={<UserOutlined />}>
                  ID do Usuário: {user.id}
                </Tag>
              </Col>
              <Col xs={24} sm={8}>
                <Tag color="green" icon={<CalendarOutlined />}>
                  Criado em: {formatDate(user.createdAt)}
                </Tag>
              </Col>
              <Col xs={24} sm={8}>
                <Tag color="orange" icon={<CheckCircleOutlined />}>
                  Status: Ativo
                </Tag>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
