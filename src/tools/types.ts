import type { RouteComponent } from 'vue-router'

export interface ToolRouteConfig {
  name: string
  path: string
  component: RouteComponent
}

export interface ToolDefinition {
  id: string
  label: string
  icon: string
  shortDescription?: string
  route: ToolRouteConfig
}
