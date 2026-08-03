from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "local"
    log_level: str = "info"
    database_url: str = "postgresql+psycopg://nimbus:nimbus@localhost:5432/nimbus"
    redis_url: str = "redis://localhost:6379/0"
    s3_endpoint: str | None = None
    s3_bucket: str = "nimbus-assets"
    aws_access_key_id: str = "test"
    aws_secret_access_key: str = "test"
    aws_default_region: str = "us-east-1"
    sqs_endpoint: str | None = None
    sqs_queue_url: str | None = None


settings = Settings()
