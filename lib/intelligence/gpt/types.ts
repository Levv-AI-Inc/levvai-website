export type GPTRole = 'system' | 'user'

export interface GPTMessage {
  role: GPTRole
  content: string
}

export interface GPTCallParams {
  messages: GPTMessage[]
  temperature?: number
}
