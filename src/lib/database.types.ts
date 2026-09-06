// Hand-written to match supabase/migrations/0001_init.sql.
// Once the Supabase CLI is linked to the project, regenerate with:
//   npx supabase gen types typescript --linked > src/lib/database.types.ts

export type TagKind = "unit" | "other";
export type IcsSource = "classes" | "tests";
export type ImportedEventSource = "classes" | "tests" | "google";
export type IcsFeedKind = "url" | "file";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          timezone: string;
          previous_timezone: string | null;
          timezone_changed_at: string | null;
          onboarded: boolean;
          task_drag_hold_ms: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string; email: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          color: string;
          kind: TagKind | null;
          group_id: string | null;
          counts_as_work: boolean;
          exclude_from_duplicate: boolean;
          archived: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tags"]["Row"]> & {
          user_id: string;
          label: string;
        };
        Update: Partial<Database["public"]["Tables"]["tags"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "tags_group_id_fkey";
            columns: ["group_id"];
            referencedRelation: "tag_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      tag_groups: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          color: string;
          is_study_unit: boolean;
          exclude_from_duplicate: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tag_groups"]["Row"]> & {
          user_id: string;
          label: string;
        };
        Update: Partial<Database["public"]["Tables"]["tag_groups"]["Row"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          tag_id: string | null;
          done: boolean;
          due_date: string | null;
          notes: string | null;
          parent_id: string | null;
          depth: number;
          sort_order: number;
          archived: boolean;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tasks"]["Row"]> & {
          user_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
        Relationships: [];
      };
      blocks: {
        Row: {
          id: string;
          user_id: string;
          tag_id: string | null;
          title: string;
          date: string;
          start_time: string;
          end_time: string;
          details: string | null;
          location: string | null;
          ics_source: IcsSource | null;
          ics_uid: string | null;
          archived: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["blocks"]["Row"]> & {
          user_id: string;
          title: string;
          date: string;
          start_time: string;
          end_time: string;
        };
        Update: Partial<Database["public"]["Tables"]["blocks"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "blocks_tag_id_fkey";
            columns: ["tag_id"];
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      ics_feeds: {
        Row: {
          id: string;
          user_id: string;
          source: IcsSource;
          label: string | null;
          tag_id: string | null;
          kind: IcsFeedKind;
          url: string | null;
          storage_path: string | null;
          last_synced_at: string | null;
          last_sync_status: string | null;
          last_sync_error: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ics_feeds"]["Row"]> & {
          user_id: string;
          source: IcsSource;
          kind: IcsFeedKind;
        };
        Update: Partial<Database["public"]["Tables"]["ics_feeds"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "ics_feeds_tag_id_fkey";
            columns: ["tag_id"];
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      imported_events: {
        Row: {
          id: string;
          user_id: string;
          source: ImportedEventSource;
          title: string;
          starts_at: string;
          ends_at: string;
          location: string | null;
          raw_uid: string;
          frozen_date: string | null;
          frozen_start_time: string | null;
          frozen_end_time: string | null;
          last_synced_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["imported_events"]["Row"]> & {
          user_id: string;
          source: ImportedEventSource;
          title: string;
          starts_at: string;
          ends_at: string;
          raw_uid: string;
        };
        Update: Partial<Database["public"]["Tables"]["imported_events"]["Row"]>;
        Relationships: [];
      };
      google_calendar_connections: {
        Row: {
          id: string;
          user_id: string;
          google_account_email: string;
          calendar_id: string;
          sync_direction: "import" | "export";
          refresh_token: string;
          last_synced_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["google_calendar_connections"]["Row"]> & {
          user_id: string;
          google_account_email: string;
          calendar_id: string;
          sync_direction: "import" | "export";
          refresh_token: string;
        };
        Update: Partial<Database["public"]["Tables"]["google_calendar_connections"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tag = Database["public"]["Tables"]["tags"]["Row"];
export type TagGroup = Database["public"]["Tables"]["tag_groups"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Block = Database["public"]["Tables"]["blocks"]["Row"];
export type IcsFeed = Database["public"]["Tables"]["ics_feeds"]["Row"];
export type ImportedEvent = Database["public"]["Tables"]["imported_events"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
