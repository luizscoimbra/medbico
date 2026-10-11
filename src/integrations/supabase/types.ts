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
      app_settings: {
        Row: {
          branch_id: string | null
          key: string
          tenant_key: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          branch_id?: string | null
          key: string
          tenant_key?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Update: {
          branch_id?: string | null
          key?: string
          tenant_key?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      application_types: {
        Row: {
          branch_id: string | null
          codigo: string
          created_at: string
          id: string
          nome: string
          tenant_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          codigo?: string
          created_at?: string
          id: string
          nome?: string
          tenant_key?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          branch_id?: string | null
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          tenant_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_types_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      battery_cycles: {
        Row: {
          avarias: string[] | null
          branch_id: string | null
          ciclo_numero: number
          component_id: string
          created_at: string | null
          data_carga: string | null
          flight_log_id: string | null
          id: string
          soh: number | null
          temperatura_operacao: number | null
          tempo_carga_min: number | null
          tenant_key: string
          voltagem_fim: number | null
          voltagem_inicio: number | null
        }
        Insert: {
          avarias?: string[] | null
          branch_id?: string | null
          ciclo_numero: number
          component_id: string
          created_at?: string | null
          data_carga?: string | null
          flight_log_id?: string | null
          id?: string
          soh?: number | null
          temperatura_operacao?: number | null
          tempo_carga_min?: number | null
          tenant_key?: string
          voltagem_fim?: number | null
          voltagem_inicio?: number | null
        }
        Update: {
          avarias?: string[] | null
          branch_id?: string | null
          ciclo_numero?: number
          component_id?: string
          created_at?: string | null
          data_carga?: string | null
          flight_log_id?: string | null
          id?: string
          soh?: number | null
          temperatura_operacao?: number | null
          tempo_carga_min?: number | null
          tenant_key?: string
          voltagem_fim?: number | null
          voltagem_inicio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "battery_cycles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battery_cycles_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "drone_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battery_cycles_flight_log_id_fkey"
            columns: ["flight_log_id"]
            isOneToOne: false
            referencedRelation: "flight_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          is_hq: boolean
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code?: string
          company_id: string
          created_at?: string
          id?: string
          is_hq?: boolean
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_hq?: boolean
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          branch_id: string | null
          cidade: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome_completo: string | null
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string | null
          telefone: string | null
          tenant_key: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id: string
          nome_completo?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string | null
          telefone?: string | null
          tenant_key?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          branch_id?: string | null
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome_completo?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string | null
          telefone?: string | null
          tenant_key?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          document: string
          id: string
          name: string
          plan: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string
          id?: string
          name: string
          plan?: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string
          id?: string
          name?: string
          plan?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_counters: {
        Row: {
          company_id: string
          kind: string
          next_value: number
          updated_at: string
        }
        Insert: {
          company_id: string
          kind: string
          next_value?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          kind?: string
          next_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      component_catalog: {
        Row: {
          branch_id: string | null
          created_at: string
          custo: number
          id: string
          marca: string
          modelo: string
          nome: string
          numero_serie: string
          tenant_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          custo?: number
          id: string
          marca?: string
          modelo?: string
          nome?: string
          numero_serie?: string
          tenant_key?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          custo?: number
          id?: string
          marca?: string
          modelo?: string
          nome?: string
          numero_serie?: string
          tenant_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "component_catalog_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      document_alerts: {
        Row: {
          alertar_dias_antes: number | null
          branch_id: string | null
          created_at: string | null
          data_vencimento: string
          drone_id: string
          id: string
          notificado: boolean | null
          tenant_key: string
          tipo: string
          titulo: string
        }
        Insert: {
          alertar_dias_antes?: number | null
          branch_id?: string | null
          created_at?: string | null
          data_vencimento: string
          drone_id: string
          id?: string
          notificado?: boolean | null
          tenant_key?: string
          tipo: string
          titulo: string
        }
        Update: {
          alertar_dias_antes?: number | null
          branch_id?: string | null
          created_at?: string | null
          data_vencimento?: string
          drone_id?: string
          id?: string
          notificado?: boolean | null
          tenant_key?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_alerts_drone_id_fkey"
            columns: ["drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
        ]
      }
      drone_components: {
        Row: {
          branch_id: string | null
          ciclo_maximo: number | null
          created_at: string | null
          drone_id: string
          especificacoes: Json | null
          horas_voo_total: number | null
          id: string
          modelo: string
          numero_serie: string | null
          status: string | null
          tenant_key: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          ciclo_maximo?: number | null
          created_at?: string | null
          drone_id: string
          especificacoes?: Json | null
          horas_voo_total?: number | null
          id?: string
          modelo: string
          numero_serie?: string | null
          status?: string | null
          tenant_key?: string
          tipo: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          ciclo_maximo?: number | null
          created_at?: string | null
          drone_id?: string
          especificacoes?: Json | null
          horas_voo_total?: number | null
          id?: string
          modelo?: string
          numero_serie?: string | null
          status?: string | null
          tenant_key?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drone_components_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drone_components_drone_id_fkey"
            columns: ["drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
        ]
      }
      drones: {
        Row: {
          apolice_seguro: string | null
          branch_id: string | null
          created_at: string | null
          data_vencimento_seguro: string | null
          horas_voo_total: number | null
          id: string
          imagem_url: string | null
          marca: string | null
          modelo: string
          mtow: number | null
          numero_serie: string
          observacoes: string | null
          registro_anac: string | null
          registro_anatel: string | null
          status: string | null
          tenant_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          apolice_seguro?: string | null
          branch_id?: string | null
          created_at?: string | null
          data_vencimento_seguro?: string | null
          horas_voo_total?: number | null
          id?: string
          imagem_url?: string | null
          marca?: string | null
          modelo: string
          mtow?: number | null
          numero_serie: string
          observacoes?: string | null
          registro_anac?: string | null
          registro_anatel?: string | null
          status?: string | null
          tenant_key?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          apolice_seguro?: string | null
          branch_id?: string | null
          created_at?: string | null
          data_vencimento_seguro?: string | null
          horas_voo_total?: number | null
          id?: string
          imagem_url?: string | null
          marca?: string | null
          modelo?: string
          mtow?: number | null
          numero_serie?: string
          observacoes?: string | null
          registro_anac?: string | null
          registro_anatel?: string | null
          status?: string | null
          tenant_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drones_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          application_rate: number | null
          branch_id: string | null
          created_at: string
          data_ultima_leitura: string | null
          equipment_model: string
          fleet_number: string
          horas_acumuladas: number
          id: string
          nozzle_spacing: number | null
          tank_capacity: number | null
          tenant_key: string
          total_nozzles: number
          tractor_model: string | null
          updated_at: string
          user_id: string
          working_speed: number | null
        }
        Insert: {
          application_rate?: number | null
          branch_id?: string | null
          created_at?: string
          data_ultima_leitura?: string | null
          equipment_model: string
          fleet_number: string
          horas_acumuladas?: number
          id: string
          nozzle_spacing?: number | null
          tank_capacity?: number | null
          tenant_key?: string
          total_nozzles: number
          tractor_model?: string | null
          updated_at?: string
          user_id?: string
          working_speed?: number | null
        }
        Update: {
          application_rate?: number | null
          branch_id?: string | null
          created_at?: string
          data_ultima_leitura?: string | null
          equipment_model?: string
          fleet_number?: string
          horas_acumuladas?: number
          id?: string
          nozzle_spacing?: number | null
          tank_capacity?: number | null
          tenant_key?: string
          total_nozzles?: number
          tractor_model?: string | null
          updated_at?: string
          user_id?: string
          working_speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_fuel_refuelings: {
        Row: {
          branch_id: string | null
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
          tenant_key: string
          tipo_combustivel: string | null
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          branch_id?: string | null
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
          tenant_key?: string
          tipo_combustivel?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          branch_id?: string | null
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
          tenant_key?: string
          tipo_combustivel?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_fuel_refuelings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_maintenance_items: {
        Row: {
          ativo: boolean | null
          branch_id: string | null
          categoria: string | null
          created_at: string | null
          custo: number | null
          id: string
          nome: string
          tenant_key: string
          tipo: string
          unidade: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          branch_id?: string | null
          categoria?: string | null
          created_at?: string | null
          custo?: number | null
          id?: string
          nome: string
          tenant_key?: string
          tipo: string
          unidade?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          branch_id?: string | null
          categoria?: string | null
          created_at?: string | null
          custo?: number | null
          id?: string
          nome?: string
          tenant_key?: string
          tipo?: string
          unidade?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_maintenance_records: {
        Row: {
          branch_id: string | null
          categoria: string
          created_at: string | null
          custo_mao_obra: number | null
          custo_total: number | null
          data: string
          descricao: string | null
          equipment_id: string
          fleet_number: string
          fornecedor_id: string | null
          fornecedor_nome: string | null
          horas_registradas: number | null
          id: string
          itens: Json | null
          observacao: string | null
          responsavel: string | null
          schedule_id: string | null
          tenant_key: string
          titulo: string
          titulo_pagar_id: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          categoria: string
          created_at?: string | null
          custo_mao_obra?: number | null
          custo_total?: number | null
          data?: string
          descricao?: string | null
          equipment_id: string
          fleet_number: string
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          horas_registradas?: number | null
          id?: string
          itens?: Json | null
          observacao?: string | null
          responsavel?: string | null
          schedule_id?: string | null
          tenant_key?: string
          titulo: string
          titulo_pagar_id?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          categoria?: string
          created_at?: string | null
          custo_mao_obra?: number | null
          custo_total?: number | null
          data?: string
          descricao?: string | null
          equipment_id?: string
          fleet_number?: string
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          horas_registradas?: number | null
          id?: string
          itens?: Json | null
          observacao?: string | null
          responsavel?: string | null
          schedule_id?: string | null
          tenant_key?: string
          titulo?: string
          titulo_pagar_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
          ativo: boolean | null
          branch_id: string | null
          categoria: string
          checklist: string[] | null
          created_at: string | null
          descricao: string | null
          equipamento_modelo: string | null
          equipment_id: string
          fleet_number: string
          id: string
          intervalo_dias: number | null
          intervalo_horas: number | null
          tenant_key: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          branch_id?: string | null
          categoria: string
          checklist?: string[] | null
          created_at?: string | null
          descricao?: string | null
          equipamento_modelo?: string | null
          equipment_id: string
          fleet_number: string
          id?: string
          intervalo_dias?: number | null
          intervalo_horas?: number | null
          tenant_key?: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          branch_id?: string | null
          categoria?: string
          checklist?: string[] | null
          created_at?: string | null
          descricao?: string | null
          equipamento_modelo?: string | null
          equipment_id?: string
          fleet_number?: string
          id?: string
          intervalo_dias?: number | null
          intervalo_horas?: number | null
          tenant_key?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_payables: {
        Row: {
          branch_id: string | null
          categoria: string
          criado_em: string
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          drone_id: string | null
          equipment_id: string | null
          forma_pagamento: string | null
          fornecedor_id: string | null
          fornecedor_nome: string
          id: string
          manutencao_id: string | null
          numero: string
          observacao: string | null
          status: string
          tenant_key: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          branch_id?: string | null
          categoria?: string
          criado_em?: string
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          drone_id?: string | null
          equipment_id?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string
          id: string
          manutencao_id?: string | null
          numero?: string
          observacao?: string | null
          status?: string
          tenant_key?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Update: {
          branch_id?: string | null
          categoria?: string
          criado_em?: string
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          drone_id?: string | null
          equipment_id?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string
          id?: string
          manutencao_id?: string | null
          numero?: string
          observacao?: string | null
          status?: string
          tenant_key?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_payables_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_receivables: {
        Row: {
          branch_id: string | null
          cliente_id: string | null
          cliente_nome: string
          criado_em: string
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          forma_pagamento: string | null
          id: string
          numero: string
          observacao: string | null
          os_id: string | null
          status: string
          tenant_key: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          branch_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          criado_em?: string
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          forma_pagamento?: string | null
          id: string
          numero?: string
          observacao?: string | null
          os_id?: string | null
          status?: string
          tenant_key?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Update: {
          branch_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          criado_em?: string
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          numero?: string
          observacao?: string | null
          os_id?: string | null
          status?: string
          tenant_key?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_receivables_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_logs: {
        Row: {
          area_nome: string | null
          branch_id: string | null
          ciclos_bateria: number | null
          cliente_nome: string | null
          combustivel_gerador_l: number | null
          condicoes_climaticas: string | null
          created_at: string | null
          cultura: string | null
          data: string
          drone_id: string
          hectares_pulverizados: number | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          observacoes: string | null
          operador_apoio: string | null
          os_id: string | null
          piloto: string | null
          produtos_aplicados: Json | null
          talhao: string | null
          temperatura_c: number | null
          tempo_voo_min: number | null
          tenant_key: string
          updated_at: string | null
          user_id: string
          vento_kmh: number | null
          volume_aplicado_l: number | null
        }
        Insert: {
          area_nome?: string | null
          branch_id?: string | null
          ciclos_bateria?: number | null
          cliente_nome?: string | null
          combustivel_gerador_l?: number | null
          condicoes_climaticas?: string | null
          created_at?: string | null
          cultura?: string | null
          data?: string
          drone_id: string
          hectares_pulverizados?: number | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          observacoes?: string | null
          operador_apoio?: string | null
          os_id?: string | null
          piloto?: string | null
          produtos_aplicados?: Json | null
          talhao?: string | null
          temperatura_c?: number | null
          tempo_voo_min?: number | null
          tenant_key?: string
          updated_at?: string | null
          user_id: string
          vento_kmh?: number | null
          volume_aplicado_l?: number | null
        }
        Update: {
          area_nome?: string | null
          branch_id?: string | null
          ciclos_bateria?: number | null
          cliente_nome?: string | null
          combustivel_gerador_l?: number | null
          condicoes_climaticas?: string | null
          created_at?: string | null
          cultura?: string | null
          data?: string
          drone_id?: string
          hectares_pulverizados?: number | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          observacoes?: string | null
          operador_apoio?: string | null
          os_id?: string | null
          piloto?: string | null
          produtos_aplicados?: Json | null
          talhao?: string | null
          temperatura_c?: number | null
          tempo_voo_min?: number | null
          tenant_key?: string
          updated_at?: string | null
          user_id?: string
          vento_kmh?: number | null
          volume_aplicado_l?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_logs_drone_id_fkey"
            columns: ["drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          role: string
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          role?: string
          token: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          role?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          branch_id: string | null
          componentes_trocados: Json | null
          created_at: string | null
          custo: number | null
          data: string
          descricao: string
          drone_id: string
          fotos_url: string[] | null
          horas_voo_registradas: number | null
          id: string
          responsavel: string | null
          schedule_id: string | null
          tenant_key: string
          tipo: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          componentes_trocados?: Json | null
          created_at?: string | null
          custo?: number | null
          data?: string
          descricao: string
          drone_id: string
          fotos_url?: string[] | null
          horas_voo_registradas?: number | null
          id?: string
          responsavel?: string | null
          schedule_id?: string | null
          tenant_key?: string
          tipo: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          componentes_trocados?: Json | null
          created_at?: string | null
          custo?: number | null
          data?: string
          descricao?: string
          drone_id?: string
          fotos_url?: string[] | null
          horas_voo_registradas?: number | null
          id?: string
          responsavel?: string | null
          schedule_id?: string | null
          tenant_key?: string
          tipo?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_drone_id_fkey"
            columns: ["drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "maintenance_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          ativo: boolean | null
          branch_id: string | null
          checklist: string[] | null
          created_at: string | null
          descricao: string
          drone_modelo: string
          id: string
          intervalo_dias: number | null
          intervalo_horas: number | null
          tenant_key: string
          tipo_manutencao: string
          titulo: string
        }
        Insert: {
          ativo?: boolean | null
          branch_id?: string | null
          checklist?: string[] | null
          created_at?: string | null
          descricao: string
          drone_modelo: string
          id?: string
          intervalo_dias?: number | null
          intervalo_horas?: number | null
          tenant_key?: string
          tipo_manutencao: string
          titulo: string
        }
        Update: {
          ativo?: boolean | null
          branch_id?: string | null
          checklist?: string[] | null
          created_at?: string | null
          descricao?: string
          drone_modelo?: string
          id?: string
          intervalo_dias?: number | null
          intervalo_horas?: number | null
          tenant_key?: string
          tipo_manutencao?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      nozzle_measurements: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          payload: Json
          tenant_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id: string
          payload?: Json
          tenant_key?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          tenant_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nozzle_measurements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          branch_id: string | null
          cracha: string
          created_at: string
          funcao: string
          id: string
          nome: string
          setor: string
          tenant_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          cracha?: string
          created_at?: string
          funcao?: string
          id: string
          nome?: string
          setor?: string
          tenant_key?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          branch_id?: string | null
          cracha?: string
          created_at?: string
          funcao?: string
          id?: string
          nome?: string
          setor?: string
          tenant_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operators_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      orders_of_service: {
        Row: {
          aplicador: string | null
          apontamentos: Json
          branch_id: string | null
          cliente_id: string | null
          cliente_nome: string | null
          codigo_aplicacao: string | null
          codigo_area: string | null
          coordenadas: string | null
          created_at: string
          data: string
          equipamentos: Json
          id: string
          os_externa: string | null
          propriedade: string
          responsavel_tecnico: string | null
          servicos: Json
          status: string | null
          talhoes: Json
          tenant_key: string
          tipo_aplicacao: string | null
          updated_at: string
          user_id: string
          valor_herbicidas: number | null
          valor_servico: number | null
          valor_total: number | null
          volume_calda_ha: string | null
        }
        Insert: {
          aplicador?: string | null
          apontamentos?: Json
          branch_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          codigo_aplicacao?: string | null
          codigo_area?: string | null
          coordenadas?: string | null
          created_at?: string
          data?: string
          equipamentos?: Json
          id: string
          os_externa?: string | null
          propriedade?: string
          responsavel_tecnico?: string | null
          servicos?: Json
          status?: string | null
          talhoes?: Json
          tenant_key?: string
          tipo_aplicacao?: string | null
          updated_at?: string
          user_id?: string
          valor_herbicidas?: number | null
          valor_servico?: number | null
          valor_total?: number | null
          volume_calda_ha?: string | null
        }
        Update: {
          aplicador?: string | null
          apontamentos?: Json
          branch_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          codigo_aplicacao?: string | null
          codigo_area?: string | null
          coordenadas?: string | null
          created_at?: string
          data?: string
          equipamentos?: Json
          id?: string
          os_externa?: string | null
          propriedade?: string
          responsavel_tecnico?: string | null
          servicos?: Json
          status?: string | null
          talhoes?: Json
          tenant_key?: string
          tipo_aplicacao?: string | null
          updated_at?: string
          user_id?: string
          valor_herbicidas?: number | null
          valor_servico?: number | null
          valor_total?: number | null
          volume_calda_ha?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_of_service_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      pilots: {
        Row: {
          branch_id: string | null
          created_at: string | null
          data_vencimento_licenca: string | null
          email: string | null
          horas_voo_total: number | null
          id: string
          licenca_anac: string | null
          nome: string
          status: string | null
          telefone: string | null
          tenant_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          data_vencimento_licenca?: string | null
          email?: string | null
          horas_voo_total?: number | null
          id?: string
          licenca_anac?: string | null
          nome: string
          status?: string | null
          telefone?: string | null
          tenant_key?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          data_vencimento_licenca?: string | null
          email?: string | null
          horas_voo_total?: number | null
          id?: string
          licenca_anac?: string | null
          nome?: string
          status?: string | null
          telefone?: string | null
          tenant_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          branch_id: string | null
          created_at: string
          culture: string
          dose: string
          id: string
          manufacturer: string
          name: string
          package_size: number | null
          tenant_key: string
          type: string
          unit: string | null
          updated_at: string
          user_id: string
          withholding_period: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          culture: string
          dose: string
          id?: string
          manufacturer: string
          name: string
          package_size?: number | null
          tenant_key?: string
          type: string
          unit?: string | null
          updated_at?: string
          user_id: string
          withholding_period: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          culture?: string
          dose?: string
          id?: string
          manufacturer?: string
          name?: string
          package_size?: number | null
          tenant_key?: string
          type?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          withholding_period?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company: string
          company_id: string | null
          created_at: string
          full_name: string
          id: string
          modules: Json | null
          phone: string | null
          role: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          company?: string
          company_id?: string | null
          created_at?: string
          full_name?: string
          id: string
          modules?: Json | null
          phone?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          company?: string
          company_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          modules?: Json | null
          phone?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      registered_products: {
        Row: {
          branch_id: string | null
          commercial_name: string
          created_at: string
          formulation: string
          id: string
          package_size: number
          preco_unitario: number | null
          tenant_key: string
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          commercial_name: string
          created_at?: string
          formulation: string
          id?: string
          package_size: number
          preco_unitario?: number | null
          tenant_key?: string
          unit: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          commercial_name?: string
          created_at?: string
          formulation?: string
          id?: string
          package_size?: number
          preco_unitario?: number | null
          tenant_key?: string
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registered_products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      service_areas: {
        Row: {
          area_carreador: number | null
          branch_id: string | null
          codigo: string | null
          coordenadas: string
          created_at: string
          id: string
          municipio: string
          nome: string
          quantidade_talhoes: number
          talhoes: Json
          tenant_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_carreador?: number | null
          branch_id?: string | null
          codigo?: string | null
          coordenadas?: string
          created_at?: string
          id: string
          municipio?: string
          nome?: string
          quantidade_talhoes?: number
          talhoes?: Json
          tenant_key?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          area_carreador?: number | null
          branch_id?: string | null
          codigo?: string | null
          coordenadas?: string
          created_at?: string
          id?: string
          municipio?: string
          nome?: string
          quantidade_talhoes?: number
          talhoes?: Json
          tenant_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_areas_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          aliquota_cofins: number | null
          aliquota_iss: number | null
          aliquota_pis: number | null
          base_calculo_iss: number | null
          branch_id: string | null
          cnae: string | null
          cod_tributacao: string | null
          codigo: string
          created_at: string
          descricao: string
          id: string
          item_lista_servico: string | null
          preco_unitario: number
          tenant_key: string
          unidade: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_iss?: number | null
          aliquota_pis?: number | null
          base_calculo_iss?: number | null
          branch_id?: string | null
          cnae?: string | null
          cod_tributacao?: string | null
          codigo: string
          created_at?: string
          descricao: string
          id?: string
          item_lista_servico?: string | null
          preco_unitario?: number
          tenant_key?: string
          unidade?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_iss?: number | null
          aliquota_pis?: number | null
          base_calculo_iss?: number | null
          branch_id?: string | null
          cnae?: string | null
          cod_tributacao?: string | null
          codigo?: string
          created_at?: string
          descricao?: string
          id?: string
          item_lista_servico?: string | null
          preco_unitario?: number
          tenant_key?: string
          unidade?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      spray_calibrations: {
        Row: {
          branch_id: string | null
          coletas: Json
          comporta_atual: number | null
          comporta_ideal: number | null
          created_at: string
          data_hora: string
          desvio_percent: number
          espacamento: number
          faixa_util: number | null
          frota: string | null
          id: string
          local_coleta: string | null
          massa_coletada: number | null
          material: string | null
          media_real: number
          metodo: string | null
          modelo_trator: string | null
          modo: string | null
          numero_bicos: number
          operador: string | null
          status_geral: string
          taxa_desejada: number
          tempo_coleta: number | null
          tenant_key: string
          tipo_implemento: string | null
          turno: string | null
          updated_at: string
          user_id: string
          vazao_max_sistema: number | null
          vazao_teorica: number
          velocidade: number
        }
        Insert: {
          branch_id?: string | null
          coletas?: Json
          comporta_atual?: number | null
          comporta_ideal?: number | null
          created_at?: string
          data_hora?: string
          desvio_percent?: number
          espacamento?: number
          faixa_util?: number | null
          frota?: string | null
          id: string
          local_coleta?: string | null
          massa_coletada?: number | null
          material?: string | null
          media_real?: number
          metodo?: string | null
          modelo_trator?: string | null
          modo?: string | null
          numero_bicos?: number
          operador?: string | null
          status_geral?: string
          taxa_desejada?: number
          tempo_coleta?: number | null
          tenant_key?: string
          tipo_implemento?: string | null
          turno?: string | null
          updated_at?: string
          user_id?: string
          vazao_max_sistema?: number | null
          vazao_teorica?: number
          velocidade?: number
        }
        Update: {
          branch_id?: string | null
          coletas?: Json
          comporta_atual?: number | null
          comporta_ideal?: number | null
          created_at?: string
          data_hora?: string
          desvio_percent?: number
          espacamento?: number
          faixa_util?: number | null
          frota?: string | null
          id?: string
          local_coleta?: string | null
          massa_coletada?: number | null
          material?: string | null
          media_real?: number
          metodo?: string | null
          modelo_trator?: string | null
          modo?: string | null
          numero_bicos?: number
          operador?: string | null
          status_geral?: string
          taxa_desejada?: number
          tempo_coleta?: number | null
          tenant_key?: string
          tipo_implemento?: string | null
          turno?: string | null
          updated_at?: string
          user_id?: string
          vazao_max_sistema?: number | null
          vazao_teorica?: number
          velocidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "spray_calibrations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      spray_mix_recipes: {
        Row: {
          area_talhao: number
          branch_id: string | null
          capacidade_tanque: number
          created_at: string
          data: string
          frota: string | null
          id: string
          modo: string | null
          produtos: Json
          talhao: string | null
          tanques_cheios: number
          tanques_necessarios: number
          tenant_key: string
          trator: string | null
          updated_at: string
          user_id: string
          vazao_trabalho: number
          volume_restante: number
          volume_total_calda: number
        }
        Insert: {
          area_talhao?: number
          branch_id?: string | null
          capacidade_tanque?: number
          created_at?: string
          data?: string
          frota?: string | null
          id: string
          modo?: string | null
          produtos?: Json
          talhao?: string | null
          tanques_cheios?: number
          tanques_necessarios?: number
          tenant_key?: string
          trator?: string | null
          updated_at?: string
          user_id?: string
          vazao_trabalho?: number
          volume_restante?: number
          volume_total_calda?: number
        }
        Update: {
          area_talhao?: number
          branch_id?: string | null
          capacidade_tanque?: number
          created_at?: string
          data?: string
          frota?: string | null
          id?: string
          modo?: string | null
          produtos?: Json
          talhao?: string | null
          tanques_cheios?: number
          tanques_necessarios?: number
          tenant_key?: string
          trator?: string | null
          updated_at?: string
          user_id?: string
          vazao_trabalho?: number
          volume_restante?: number
          volume_total_calda?: number
        }
        Relationships: [
          {
            foreignKeyName: "spray_mix_recipes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_entries: {
        Row: {
          branch_id: string | null
          categoria: string
          created_at: string | null
          data: string
          fornecedor: string | null
          id: string
          item_key: string
          item_nome: string
          observacao: string | null
          origem: string
          quantidade: number
          tenant_key: string
          tipo: string
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          branch_id?: string | null
          categoria: string
          created_at?: string | null
          data?: string
          fornecedor?: string | null
          id?: string
          item_key: string
          item_nome: string
          observacao?: string | null
          origem?: string
          quantidade: number
          tenant_key?: string
          tipo?: string
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          branch_id?: string | null
          categoria?: string
          created_at?: string | null
          data?: string
          fornecedor?: string | null
          id?: string
          item_key?: string
          item_nome?: string
          observacao?: string | null
          origem?: string
          quantidade?: number
          tenant_key?: string
          tipo?: string
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_settings: {
        Row: {
          ativo: boolean
          branch_id: string | null
          branch_key: string
          categoria: string
          created_at: string | null
          item_key: string
          minimo: number
          tenant_key: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          branch_id?: string | null
          branch_key?: string
          categoria: string
          created_at?: string | null
          item_key: string
          minimo?: number
          tenant_key?: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          branch_id?: string | null
          branch_key?: string
          categoria?: string
          created_at?: string | null
          item_key?: string
          minimo?: number
          tenant_key?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          branch_id: string | null
          created_at: string
          documento: string | null
          email: string | null
          id: string
          nome: string
          telefone: string | null
          tenant_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          id: string
          nome?: string
          telefone?: string | null
          tenant_key?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          tenant_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branches: {
        Row: {
          branch_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      water_trucks: {
        Row: {
          branch_id: string | null
          capacity: number
          created_at: string
          fleet_number: string
          id: string
          model: string
          tenant_key: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          capacity?: number
          created_at?: string
          fleet_number: string
          id: string
          model?: string
          tenant_key?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          capacity?: number
          created_at?: string
          fleet_number?: string
          id?: string
          model?: string
          tenant_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_trucks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      branch_overview: {
        Args: never
        Returns: {
          branch_id: string
          codigo: string
          is_hq: boolean
          nome: string
          ordens: number
          saldo_itens: number
          status: string
          usuarios: number
        }[]
      }
      create_branch: {
        Args: { p_code?: string; p_name: string }
        Returns: string
      }
      current_branch_ids: { Args: never; Returns: string[] }
      current_company_active: { Args: never; Returns: boolean }
      current_company_id: { Args: never; Returns: string }
      current_is_company_admin: { Args: never; Returns: boolean }
      current_tenant_key: { Args: never; Returns: string }
      delete_stock_entry: { Args: { p_id: string }; Returns: Json }
      delete_user: { Args: { target: string }; Returns: undefined }
      is_company_admin: { Args: { p_role: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_tenant_admin: { Args: never; Returns: boolean }
      is_tenant_master: { Args: never; Returns: boolean }
      legacy_tenant_default: { Args: never; Returns: string }
      link_user_to_tenant: {
        Args: {
          p_full_name?: string
          p_phone?: string
          p_role?: string
          target: string
        }
        Returns: undefined
      }
      next_company_counter: { Args: { p_kind: string }; Returns: number }
      next_os_id: { Args: { p_prefix: string }; Returns: string }
      next_payable_numero: { Args: never; Returns: string }
      next_receivable_numero: { Args: never; Returns: string }
      norm_key: { Args: { txt: string }; Returns: string }
      platform_companies: {
        Args: never
        Returns: {
          criada_em: string
          documento: string
          filiais: number
          id: string
          nome: string
          plan: string
          slug: string
          status: string
          status_em: string
          usuarios: number
        }[]
      }
      platform_grant: {
        Args: { p_email: string; p_grant?: boolean }
        Returns: undefined
      }
      platform_set_company_status: {
        Args: { p_company: string; p_status: string }
        Returns: undefined
      }
      profile_in_current_company: { Args: { p_id: string }; Returns: boolean }
      profile_tenant_key: {
        Args: { p_company: string; p_id: string }
        Returns: string
      }
      register_stock_entry:
        | {
            Args: {
              p_categoria: string
              p_data?: string
              p_fornecedor?: string
              p_item_key: string
              p_item_nome: string
              p_observacao?: string
              p_quantidade: number
              p_valor_total?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_branch_id?: string
              p_categoria: string
              p_data?: string
              p_fornecedor?: string
              p_item_key: string
              p_item_nome: string
              p_observacao?: string
              p_quantidade: number
              p_valor_total?: number
            }
            Returns: Json
          }
      rename_own_company: {
        Args: { p_document?: string; p_name: string }
        Returns: undefined
      }
      set_stock_minimum:
        | {
            Args: { p_categoria: string; p_item_key: string; p_minimo: number }
            Returns: Json
          }
        | {
            Args: {
              p_branch_id?: string
              p_categoria: string
              p_item_key: string
              p_minimo: number
            }
            Returns: Json
          }
      set_user_branches: {
        Args: { p_branches: string[]; p_target: string }
        Returns: undefined
      }
      set_user_modules: {
        Args: { p_modules: Json; target: string }
        Returns: undefined
      }
      set_user_role: {
        Args: { p_role: string; target: string }
        Returns: undefined
      }
      set_user_status: {
        Args: { p_status: string; target: string }
        Returns: undefined
      }
      stock_balance: { Args: { p_branch_key: string }; Returns: number }
      stock_snapshot: { Args: { p_branch?: string }; Returns: Json }
      test_simple: { Args: never; Returns: Json }
      to_num: { Args: { txt: string }; Returns: number }
      transfer_stock: {
        Args: {
          p_de: string
          p_item_key: string
          p_item_nome: string
          p_observacao?: string
          p_para: string
          p_quantidade: number
        }
        Returns: Json
      }
      transfer_targets: {
        Args: { p_de: string }
        Returns: {
          branch_id: string
          codigo: string
          nome: string
          saldo: number
        }[]
      }
      unique_company_slug: { Args: { p_name: string }; Returns: string }
      unique_tenant_slug: { Args: { p_name: string }; Returns: string }
      update_branch: {
        Args: {
          p_branch: string
          p_code?: string
          p_name: string
          p_status?: string
        }
        Returns: undefined
      }
      update_my_profile: {
        Args: { p_full_name: string; p_phone: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
