# EvoMatch

Leia integralmente o PDF anexado antes de iniciar qualquer implementação.

Este PDF contém a especificação oficial e obrigatória do EvoMatch. Os 748 pontos não são sugestões, ideias opcionais nem referências para inspiração: eles definem como o aplicativo deve ser construído, quais funcionalidades deve possuir, como elas devem se conectar e quais critérios precisam ser cumpridos para considerar o projeto pronto.

O objetivo é construir o EvoMatch como um produto real e utilizável, unindo rede social esportiva, descoberta de pessoas, matching esportivo, registro de atividades, rankings, desafios, convites, comunidades, profissionais, academias, locais esportivos, eventos, parceiros, geolocalização, chat, segurança e demais funcionalidades descritas no documento.

IMPORTANTE:

Leia os 748 pontos antes de começar.

Não resuma o PDF.

Não simplifique os requisitos.

Não transforme o projeto em MVP.

Não escolha apenas algumas funcionalidades para implementar.

Não substitua funcionalidades complexas por versões visuais ou simuladas.

Não altere arbitrariamente a identidade e as telas canônicas fornecidas.

Não crie usuários, profissionais, academias, avaliações, seguidores, posts, mensagens, rankings, eventos ou qualquer outro conteúdo fictício apenas para preencher a interface.

Não deixe botões sem função.

Não simule ações com mensagens falsas de sucesso.

Toda ação que deveria ser persistente deve continuar existindo após atualizar a página.

Toda funcionalidade social deve funcionar entre usuários reais.

Tudo que for cadastrado por um usuário, profissional, parceiro ou estabelecimento deve ser sincronizado e aparecer corretamente para os demais usuários autorizados.

Localização, distância, uploads, chat, agendamentos, convites, treinos, interações e demais recursos devem possuir fluxos reais.

Supabase deve ser preparado para autenticação, banco, relações, segurança, RLS, Realtime, PostGIS e lógica correspondente.

Cloudflare R2 deve ser preparado para armazenamento e entrega das mídias pesadas.

Quando uma função depender de credenciais ou serviços externos ainda não configurados, implemente toda a arquitetura, interface, fluxo, tratamento de erros e integração possível, deixando pendente somente a configuração externa necessária.

Não declare como concluído aquilo que ainda estiver apenas visualmente implementado.

O resultado esperado NÃO é um protótipo do EvoMatch.

O resultado esperado é o próprio EvoMatch construído conforme os 748 requisitos do PDF, com todas as partes integradas entre si e preparado para uso real.

Trate cada número do PDF como um requisito verificável.

Antes de considerar o trabalho concluído, percorra novamente os 748 pontos, um por um, e confirme que cada requisito foi implementado corretamente ou identifique explicitamente qualquer dependência externa que impeça sua ativação.

REGRA PRINCIPAL:

Não construa um aplicativo que apenas PAREÇA funcionar.

Construa um aplicativo preparado para FUNCIONAR de verdade.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://evomatch.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c4c748f1-0d37-4eb2-aca1-07cbceae823b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
