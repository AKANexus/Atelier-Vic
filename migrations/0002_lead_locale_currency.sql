ALTER TABLE leads ADD COLUMN locale TEXT NOT NULL DEFAULT 'pt-BR' CHECK (locale IN ('pt-BR', 'en-US'));
ALTER TABLE leads ADD COLUMN currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency IN ('BRL', 'USD'));
