from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/stock_analyst"

    cors_origins: list[str] = ["http://localhost:3001"]

    alpaca_data_url: str = "https://data.alpaca.markets"
    alpaca_client_id: str = ""
    alpaca_client_secret: str = ""

    model_config = SettingsConfigDict(env_file=(".env", ".env.local"), extra="ignore")


settings = Settings()
