export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      equipment: {
        Row: {
          created_at: string
          equipment_model: string
          fleet_number: string
          id: string
          tank_capacity: number
          total_nozzles: number
          tractor_model: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipment_model: string
          fleet_number: string
          id?: string
          tank_capacity?: number
          total_nozzles: number
          tractor_model?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipment_model?: string
          fleet_number?: string
          id?: string
          tank_capacity?: number
          total_nozzles?: number
          tractor_model?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          culture: string
          dose: string
          id: string
          manufacturer: string
          name: string
          package_size: number
          type: string
          unit: string
          updated_at: string
          user_id: string
          withholding_period: string
        }
        Insert: {
          created_at?: string
          culture: string
          dose: string
          id?: string
          manufacturer: string
          name: string
          package_size?: number
          type: string
          unit?: string
          updated_at?: string
          user_id: string
          withholding_period: string
        }
        Update: {
          created_at?: string
          culture?: string
          dose?: string
          id?: string
          manufacturer?: string
          name?: string
          package_size?: number
          type?: string
          unit?: string
          updated_at?: string
          user_id?: string
          withholding_period?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string
          created_at: string
          full_name: string
          id: string
          modules: Json | null
          phone: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          company?: string
          created_at?: string
          full_name?: string
          id: string
          modules?: Json | null
          phone?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          company?: string
          created_at?: string
          full_name?: string
          id?: string
          modules?: Json | null
          phone?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      registered_products: {
        Row: {
          commercial_name: string
          created_at: string
          formulation: string
          id: string
          package_size: number
          preco_unitario: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          commercial_name: string
          created_at?: string
          formulation: string
          id?: string
          package_size: number
          preco_unitario?: number
          unit: string
          updated_at?: string
          user_id: string
        }
        Update: {
          commercial_name?: string
          created_at?: string
          formulation?: string
          id?: string
          package_size?: number
          preco_unitario?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          aliquota_cofins: number
          aliquota_iss: number
          aliquota_pis: number
          base_calculo_iss: number
          cnae: string
          cod_tributacao: string
          codigo: string
          created_at: string
          descricao: string
          id: string
          item_lista_servico: string
          preco_unitario: number
          unidade: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aliquota_cofins?: number
          aliquota_iss?: number
          aliquota_pis?: number
          base_calculo_iss?: number
          cnae?: string
          cod_tributacao?: string
          codigo: string
          created_at?: string
          descricao: string
          id?: string
          item_lista_servico?: string
          preco_unitario: number
          unidade?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aliquota_cofins?: number
          aliquota_iss?: number
          aliquota_pis?: number
          base_calculo_iss?: number
          cnae?: string
          cod_tributacao?: string
          codigo?: string
          created_at?: string
          descricao?: string
          id?: string
          item_lista_servico?: string
          preco_unitario?: number
          unidade?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      equipment_maintenance_items: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          custo: number
          id: string
          nome: string
          tipo: string
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          custo?: number
          id?: string
          nome: string
          tipo: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          custo?: number
          id?: string
          nome?: string
          tipo?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipment_maintenance_records: {
        Row: {
          categoria: string
          created_at: string
          custo_mao_obra: number
          custo_total: number
          data: string
          descricao: string
          equipment_id: string
          fleet_number: string
          fornecedor_id: string
          fornecedor_nome: string
          horas_registradas: number
          id: string
          itens: Json
          observacao: string
          responsavel: string
          schedule_id: string | null
          titulo: string
          titulo_pagar_id: string
          updated_at: string
        }
        Insert: {
          categoria: string
          created_at?: string
          custo_mao_obra?: number
          custo_total?: number
          data?: string
          descricao?: string
          equipment_id: string
          fleet_number: string
          fornecedor_id?: string
          fornecedor_nome?: string
          horas_registradas?: number
          id?: string
          itens?: Json
          observacao?: string
          responsavel?: string
          schedule_id?: string | null
          titulo: string
          titulo_pagar_id?: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          custo_mao_obra?: number
          custo_total?: number
          data?: string
          descricao?: string
          equipment_id?: string
          fleet_number?: string
          fornecedor_id?: string
          fornecedor_nome?: string
          horas_registradas?: number
          id?: string
          itens?: Json
          observacao?: string
          responsavel?: string
          schedule_id?: string | null
          titulo?: string
          titulo_pagar_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "equipment_maintenance_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_maintenance_schedules: {
        Row: {
          ativo: boolean
          categoria: string
          checklist: string[]
          created_at: string
          descricao: string
          equipamento_modelo: string
          equipment_id: string
          fleet_number: string
          id: string
          intervalo_dias: number
          intervalo_horas: number
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          checklist?: string[]
          created_at?: string
          descricao?: string
          equipamento_modelo?: string
          equipment_id: string
          fleet_number: string
          id?: string
          intervalo_dias?: number
          intervalo_horas?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          checklist?: string[]
          created_at?: string
          descricao?: string
          equipamento_modelo?: string
          equipment_id?: string
          fleet_number?: string
          id?: string
          intervalo_dias?: number
          intervalo_horas?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipment_fuel_refuelings: {
        Row: {
          created_at: string | null
          data: string
          equipment_id: string
          fleet_number: string
          horimetro: number
          id: string
          litros: number
          observacao: string | null
          os_id: string | null
          posto_fornecedor: string | null
          tipo_combustivel: string | null
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string | null
          data?: string
          equipment_id: string
          fleet_number: string
          horimetro: number
          id?: string
          litros: number
          observacao?: string | null
          os_id?: string | null
          posto_fornecedor?: string | null
          tipo_combustivel?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          created_at?: string | null
          data?: string
          equipment_id?: string
          fleet_number?: string
          horimetro?: number
          id?: string
          litros?: number
          observacao?: string | null
          os_id?: string | null
          posto_fornecedor?: string | null
          tipo_combustivel?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: []
      }
      stock_entries: {
        Row: {
          categoria: string
          created_at: string | null
          data: string
          fornecedor: string | null
          id: string
          item_key: string
          item_nome: string
          observacao: string | null
          quantidade: number
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          categoria: string
          created_at?: string | null
          data?: string
          fornecedor?: string | null
          id?: string
          item_key: string
          item_nome: string
          observacao?: string | null
          quantidade: number
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          categoria?: string
          created_at?: string | null
          data?: string
          fornecedor?: string | null
          id?: string
          item_key?: string
          item_nome?: string
          observacao?: string | null
          quantidade?: number
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: []
      }
      stock_settings: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string | null
          item_key: string
          minimo: number
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string | null
          item_key: string
          minimo?: number
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string | null
          item_key?: string
          minimo?: number
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_user: {
        Args: {
          target: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
