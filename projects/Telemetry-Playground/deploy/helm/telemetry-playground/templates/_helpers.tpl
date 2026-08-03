{{- define "telemetry.name" -}}
telemetry-playground
{{- end }}

{{- define "telemetry.namespace" -}}
{{ .Values.namespace | default "telemetry" }}
{{- end }}

{{- define "telemetry.labels" -}}
app.kubernetes.io/name: {{ include "telemetry.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: telemetry-playground
{{- end }}

{{- define "telemetry.selectorLabels" -}}
app.kubernetes.io/name: {{ include "telemetry.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "telemetry.image" -}}
{{- $repo := index . 0 -}}
{{- $tag := index . 1 -}}
{{- if contains ":" $repo -}}
{{ $repo }}
{{- else -}}
{{ printf "%s:%s" $repo $tag }}
{{- end -}}
{{- end }}

{{- define "telemetry.otelEnv" -}}
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: {{ .Values.config.otelEndpoint | quote }}
- name: OTEL_EXPORTER_OTLP_INSECURE
  value: {{ .Values.config.otelInsecure | quote }}
- name: OTEL_EXPORTER_OTLP_PROTOCOL
  value: grpc
- name: ENVIRONMENT
  value: {{ .Values.config.environment | quote }}
- name: REGION
  value: {{ .Values.config.region | quote }}
- name: LOG_LEVEL
  value: {{ .Values.config.logLevel | quote }}
{{- end }}
