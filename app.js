// Santo Play - ação do botão "Reproduzir agora"
// Opção mais estável: abrir uma busca (nunca fica "indisponível")
function playLouvor() {
  const query = encodeURIComponent("louvor e adoração presença de Deus");
  const url = `https://www.youtube.com/results?search_query=${query}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
