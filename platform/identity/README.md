# Identity

O contrato de identidade inicial está em `apps/api/app/security/auth.py`. O desenvolvimento local usa um principal controlado e limitado ao loopback; ambientes não locais exigem tokens de runtime, organização e papéis. A integração futura com um provedor de identidade deve substituir o resolver de tokens sem alterar os módulos tenant-scoped.
