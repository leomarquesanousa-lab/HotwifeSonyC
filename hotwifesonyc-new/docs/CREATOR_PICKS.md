# Creator Picks — galeria local

Adicione JPG, JPEG, PNG ou WebP diretamente em `public/images/creator-picks/`.
Ao recarregar a homepage, a galeria lê todos os arquivos dessa pasta em ordem
natural pelo nome (01, 02, …, 10). Não há substituição por fotos antigas.
Arquivos idênticos às fotografias de hero e Meet são excluídos por SHA-256,
mesmo se renomeados. Originais nunca são modificados.

Miniaturas: 5 colunas acima de 1100px, 3 até 1100px, 2 até 600px;
proporção 1:1, bordas 8px, carregamento lazy e otimização Next Image.
O lightbox usa o arquivo original com object-fit: contain, setas, X e ESC.
Adicionar/remover imagens exige apenas recarregar a página local, sem editar código.

## Enquadramento e acessibilidade

Sem detector facial instalado ou promessa de detecção automática. O padrão
é `50% 30%`, favorecendo a região superior. Revise visualmente cada nova foto
e configure coordenadas percentuais de object-position em
`content/creator-picks.json`, usando o nome exato do arquivo:

```json
{
  "01.jpg": {
    "focal": [50, 20],
    "alt": "Descrição objetiva da fotografia"
  }
}
```

Valores de 0 a 100. Uma entrada por foto é opcional. Não é necessário
configurar novos arquivos para que apareçam. Este JSON não é uma lista de
imagens nem modifica as fotografias; apenas permite corrigir o recorte visual.

Os registros antigos de Creator Picks continuam preservados no armazenamento
administrativo, mas não controlam mais esta galeria pública. O painel continua
gerenciando biografia, fotos superiores, catálogo e plataformas normalmente.
A galeria é gerenciada pela pasta e pelo JSON de enquadramento, como solicitado.

Não há fotos novas disponíveis nesta entrega. A revisão final de todos os
rostos e a validação com as fotografias reais dependem de adicioná-las à pasta.
