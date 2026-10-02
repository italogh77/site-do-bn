
    /* ========================================================
       ESTADO E DADOS
       ======================================================== */
    const STORAGE_KEY = 'grupo_solutions_frota_v5';
    let appData = carregarDadosIniciais();
    let editandoRegistroId = null;
    let servidorDisponivel = false;

    function carregarDadosIniciais() {
      try {
        const salvo = localStorage.getItem(STORAGE_KEY);
        if (salvo) {
          const parsed = JSON.parse(salvo);
          if (parsed && Array.isArray(parsed.veiculos)) return parsed;
        }
      } catch (e) {
        console.warn('Erro ao ler localStorage', e);
      }

      try {
        const embutido = JSON.parse(document.getElementById('dadosIncorporados').textContent || '{}');
        if (embutido && Array.isArray(embutido.veiculos)) return embutido;
      } catch (e) {
        console.warn('Erro ao ler dados incorporados', e);
      }

      return {
        versao: 2,
        aplicativo: "Controle de Veículos",
        exportadoEm: new Date().toISOString(),
        condutores: [],
        registros: [],
        veiculos: [],
        placasAlugados: []
      };
    }

    function salvarLocalmente(dispararAutoSync = true) {
      appData.exportadoEm = new Date().toISOString();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
      } catch (e) {
        console.error('Erro ao salvar no localStorage', e);
      }

      // Se servidor local estiver disponível, salva arquivos e executa auto-sync
      const autoPush = dispararAutoSync && document.getElementById('checkAutoPushConfig')?.checked;
      salvarNoServidorLocal(autoPush);
    }

    /* ========================================================
       SINCRONIZAÇÃO COM O REPOSITÓRIO GITHUB / SERVIDOR
       ======================================================== */
    async function testarServidorLocal() {
      try {
        const resp = await fetch('/api/status', { cache: 'no-store' });
        if (resp.ok) {
          const info = await resp.json();
          servidorDisponivel = true;
          document.getElementById('repoPillText').innerHTML = `Repositório: <strong>${info.repository}</strong>`;
          document.getElementById('badgeGitStatus').textContent = '🟢 Conectado ao Servidor & Git';
          document.getElementById('badgeGitStatus').className = 'status-badge status-ok';
          verificarStatusGit();
          return true;
        }
      } catch (e) {
        servidorDisponivel = false;
        document.getElementById('repoPillText').innerHTML = `Repositório: <strong>italogh77/site-do-bn</strong>`;
        document.getElementById('badgeGitStatus').textContent = '☁️ Modo Web (GitHub API)';
        document.getElementById('badgeGitStatus').className = 'status-badge status-alerta';
      }
      return false;
    }

    async function salvarNoServidorLocal(autoPush = false) {
      if (!servidorDisponivel) return;

      try {
        // Prepara HTML com os dados incorporados atualizados
        const pacote = JSON.parse(JSON.stringify(appData));
        const clone = document.documentElement.cloneNode(true);
        const scriptDados = clone.querySelector('#dadosIncorporados');
        if (scriptDados) scriptDados.textContent = JSON.stringify(pacote, null, 2);

        const htmlCompleto = '<!DOCTYPE html>\n' + clone.outerHTML;

        await fetch('/api/salvar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            html: htmlCompleto,
            dados: pacote,
            autoPush: autoPush
          })
        });

        if (autoPush) {
          mostrarToast('Alterações salvas e enviadas para o GitHub!', 'success');
        }
      } catch (e) {
        console.warn('Falha na gravação automática do servidor', e);
      }
    }

    async function verificarStatusGit() {
      const rep = document.getElementById('gitStatusReport');
      if (!servidorDisponivel) {
        rep.textContent = 'Servidor local não detectado. Use ABRIR_SITE.bat ou insira o Token GitHub.';
        return;
      }
      try {
        rep.textContent = 'Verificando status do Git...';
        const resp = await fetch('/api/git-status');
        const data = await resp.json();
        if (data.clean) {
          rep.textContent = '✅ Tudo sincronizado com o GitHub!';
        } else {
          rep.textContent = '⚠️ Há alterações locais aguardando envio para o GitHub.';
        }
      } catch (e) {
        rep.textContent = '';
      }
    }

    async function subirParaGitHub() {
      const btnHeader = document.getElementById('btnHeaderPush');
      const btnMain = document.getElementById('btnSubirGitHubPrincipal');

      const originalText = btnHeader.innerHTML;
      btnHeader.innerHTML = '<span>⏳</span> Enviando...';
      btnHeader.disabled = true;
      if (btnMain) { btnMain.innerHTML = '⏳ Enviando para o GitHub...'; btnMain.disabled = true; }

      try {
        // 1. Prepara HTML e dados
        const pacote = JSON.parse(JSON.stringify(appData));
        const clone = document.documentElement.cloneNode(true);
        const scriptDados = clone.querySelector('#dadosIncorporados');
        if (scriptDados) scriptDados.textContent = JSON.stringify(pacote, null, 2);
        const htmlCompleto = '<!DOCTYPE html>\n' + clone.outerHTML;

        // Se servidor local estiver ativo:
        if (servidorDisponivel) {
          const resp = await fetch('/api/git-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              html: htmlCompleto,
              dados: pacote,
              message: `Atualizações realizadas no site em ${new Date().toLocaleString('pt-BR')}`
            })
          });

          const resData = await resp.json();
          if (resData.success) {
            mostrarToast('🎉 SUCESSO! Alterações enviadas para o repositório no GitHub!', 'success');
            verificarStatusGit();
          } else {
            throw new Error(resData.error || 'Erro ao enviar para o Git');
          }
        } else {
          // Fallback via GitHub REST API se houver token
          const token = localStorage.getItem('gh_token') || document.getElementById('inputGitToken')?.value;
          const repo = localStorage.getItem('gh_repo') || 'italogh77/site-do-bn';

          if (!token) {
            navegarPara('sincronizacao');
            throw new Error('Inicie o site pelo arquivo ABRIR_SITE.bat no seu computador ou configure um Token do GitHub.');
          }

          mostrarToast('Enviando via GitHub API...', 'info');
          await enviarViaGitHubApi(repo, token, htmlCompleto, pacote);
          mostrarToast('🎉 SUCESSO! Arquivos atualizados no GitHub via API!', 'success');
        }
      } catch (err) {
        mostrarToast('Erro ao subir para o GitHub: ' + err.message, 'error');
      } finally {
        btnHeader.innerHTML = originalText;
        btnHeader.disabled = false;
        if (btnMain) { btnMain.innerHTML = '🚀 Subir Alterações para o GitHub Agora'; btnMain.disabled = false; }
      }
    }

    async function enviarViaGitHubApi(repo, token, htmlContent, dadosContent) {
      // Atualiza index.html e controle_veiculos_prototipo_v5.html
      const arquivosParaAtualizar = [
        { path: 'index.html', content: htmlContent },
        { path: 'controle_veiculos_prototipo_v5.html', content: htmlContent },
        { path: 'dados.json', content: JSON.stringify(dadosContent, null, 2) }
      ];

      for (const item of arquivosParaAtualizar) {
        let sha = null;
        try {
          const check = await fetch(`https://api.github.com/repos/${repo}/contents/${item.path}`, {
            headers: { 'Authorization': `token ${token}` }
          });
          if (check.ok) {
            const fData = await check.json();
            sha = fData.sha;
          }
        } catch (_) {}

        const body = {
          message: `Atualização de ${item.path} pelo site em ${new Date().toLocaleString('pt-BR')}`,
          content: btoa(unescape(encodeURIComponent(item.content))),
          branch: 'main'
        };
        if (sha) body.sha = sha;

        const putResp = await fetch(`https://api.github.com/repos/${repo}/contents/${item.path}`, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!putResp.ok) {
          const errData = await putResp.json();
          throw new Error(errData.message || 'Falha ao gravar arquivo no GitHub');
        }
      }
    }

    async function puxarDoGitHub() {
      if (!servidorDisponivel) {
        mostrarToast('Inicie o servidor pelo ABRIR_SITE.bat para puxar dados via Git.', 'error');
        return;
      }
      try {
        mostrarToast('Puxando novidades do GitHub...', 'info');
        const resp = await fetch('/api/git-pull', { method: 'POST' });
        const data = await resp.json();
        if (data.success) {
          mostrarToast('Atualizações baixadas! Recarregando a página...', 'success');
          setTimeout(() => location.reload(), 1200);
        } else {
          throw new Error(data.error);
        }
      } catch (e) {
        mostrarToast('Erro ao puxar: ' + e.message, 'error');
      }
    }

    function toggleAutoPush(ativado) {
      localStorage.setItem('auto_push_github', ativado ? '1' : '0');
      document.getElementById('checkAutoPush').checked = ativado;
      document.getElementById('checkAutoPushConfig').checked = ativado;
      mostrarToast(ativado ? 'Auto-envio para o GitHub ativado!' : 'Auto-envio desativado.', 'info');
    }

    function salvarConfigTokenGit() {
      const repo = document.getElementById('inputGitRepo').value.trim();
      const token = document.getElementById('inputGitToken').value.trim();
      if (repo) localStorage.setItem('gh_repo', repo);
      if (token) localStorage.setItem('gh_token', token);
      mostrarToast('Configurações salvas no navegador!', 'success');
    }

    /* ========================================================
       ROTEAMENTO E NAVEGAÇÃO
       ======================================================== */
    const titulosPaginas = {
      inicio: { title: 'Controle de Veículos', sub: 'Sua frota organizada com controle de quilometragem e revisões em dia.' },
      veiculos: { title: 'Veículos Cadastrados', sub: 'Gerencie os veículos da frota, com placas, condutores e revisões.' },
      registro: { title: 'Saída e Retorno', sub: 'Registre a utilização dos veículos com verificação de KM.' },
      revisoes: { title: 'Revisões e Alertas', sub: 'Acompanhamento preventivo para garantir a segurança da frota.' },
      historico: { title: 'Histórico Completo', sub: 'Relatório geral de utilizações, condutores e distâncias percorridas.' },
      condutores: { title: 'Condutores Cadastrados', sub: 'Controle de motoristas autorizados para utilização.' },
      pastas: { title: 'Pastas por Veículo', sub: 'Dossiê individual com dados e histórico exclusivo de cada veículo.' },
      sincronizacao: { title: 'GitHub & Backup', sub: 'Sincronize suas alterações diretamente com o repositório GitHub.' }
    };

    function rotear() {
      let rota = location.hash.slice(1) || 'inicio';
      if (!titulosPaginas[rota]) rota = 'inicio';

      document.body.dataset.page = rota;
      document.querySelectorAll('main > section').forEach(sec => {
        sec.hidden = (sec.id !== rota);
      });

      const info = titulosPaginas[rota];
      document.getElementById('pageTitle').textContent = info.title;
      document.getElementById('crumb').textContent = info.title;
      document.getElementById('pageSubtitle').textContent = info.sub;

      document.querySelectorAll('nav a[data-route]').forEach(link => {
        const ativa = link.dataset.route === rota;
        link.classList.toggle('active', ativa);
      });

      fecharMenu();
      renderizarTelaAtual(rota);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    function navegarPara(rota) {
      location.hash = '#' + rota;
    }

    function fecharMenu() {
      document.body.classList.remove('menu-open');
    }

    function toggleMenu() {
      document.body.classList.toggle('menu-open');
    }

    window.addEventListener('hashchange', rotear);

    function renderizarTelaAtual(rota) {
      if (rota === 'inicio') renderDashboard();
      if (rota === 'veiculos') renderListaVeiculos();
      if (rota === 'registro') prepararFormularioRegistro();
      if (rota === 'revisoes') renderRevisoes();
      if (rota === 'historico') renderHistorico();
      if (rota === 'condutores') renderCondutores();
      if (rota === 'pastas') renderPastasVeiculos();
    }

    /* ========================================================
       FORMATAÇÕES E UTILITÁRIOS
       ======================================================== */
    function formatarKm(num) {
      return Number(num || 0).toLocaleString('pt-BR');
    }

    function formatarDataBR(dataIso) {
      if (!dataIso) return '';
      const p = dataIso.split('-');
      if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
      return dataIso;
    }

    function esc(str) {
      return String(str || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }

    function formatarPlaca(placa) {
      const limpa = String(placa || '').replace(/[\s-]/g, '').toUpperCase();
      if (limpa.length === 7) return limpa.slice(0, 3) + '-' + limpa.slice(3);
      return placa;
    }

    function renderPlacaBadgeHtml(placa) {
      const fPlaca = formatarPlaca(placa);
      return `
        <div class="placa-badge">
          <div class="placa-top">BRASIL</div>
          <div class="placa-code">${esc(fPlaca)}</div>
        </div>
      `;
    }

    function statusRevisaoVeiculo(v) {
      const atual = Number(v.kmAtual || 0);
      const revisao = Number(v.kmRevisao || 0);
      const falta = revisao - atual;

      if (falta <= 0) {
        return {
          classe: 'status-vencida',
          texto: 'REVISÃO VENCIDA',
          falta,
          alerta: true,
          vencida: true,
          percent: 100
        };
      }
      if (falta <= 1000) {
        return {
          classe: 'status-alerta',
          texto: 'PERTO DA REVISÃO',
          falta,
          alerta: true,
          vencida: false,
          percent: Math.min(100, Math.round((atual / revisao) * 100))
        };
      }
      return {
        classe: 'status-ok',
        texto: 'EM DIA',
        falta,
        alerta: false,
        vencida: false,
        percent: Math.min(100, Math.max(0, Math.round((atual / revisao) * 100)))
      };
    }

    function mostrarToast(msg, tipo = 'info') {
      const container = document.getElementById('toastContainer');
      const el = document.createElement('div');
      el.className = `toast ${tipo}`;
      el.innerHTML = `<span>${tipo === 'success' ? '✅' : tipo === 'error' ? '❌' : 'ℹ️'}</span> <div>${msg}</div>`;
      container.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        el.style.transition = 'all 0.3s ease';
        setTimeout(() => el.remove(), 300);
      }, 4500);
    }

    /* ========================================================
       1. VISÃO GERAL (DASHBOARD)
       ======================================================== */
    function renderDashboard() {
      document.getElementById('countVehicles').textContent = appData.veiculos.length;
      document.getElementById('countRentals').textContent = (appData.placasAlugados || []).length;
      document.getElementById('countTrips').textContent = appData.registros.length;

      const totalKm = appData.registros.reduce((acc, r) => acc + Number(r.kmRodados || 0), 0);
      document.getElementById('countTotalKm').textContent = formatarKm(totalKm) + ' km';

      // Próxima revisão mais urgente
      const alugados = appData.veiculos.filter(v => (appData.placasAlugados || []).includes(v.placa));
      const urgentes = (alugados.length > 0 ? alugados : appData.veiculos)
        .map(v => ({ v, st: statusRevisaoVeiculo(v) }))
        .sort((a, b) => a.st.falta - b.st.falta);

      const boxRev = document.getElementById('dashboardNextReview');
      if (urgentes.length > 0) {
        const top = urgentes[0];
        boxRev.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <div>
              <strong style="font-size:16px;">${esc(top.v.modelo)}</strong>
              <div style="margin-top:4px;">${renderPlacaBadgeHtml(top.v.placa)}</div>
            </div>
            <span class="status-badge ${top.st.classe}">${top.st.texto}</span>
          </div>
          <div style="margin-top:12px;font-size:13px;color:var(--muted)">
            KM Atual: <b>${formatarKm(top.v.kmAtual)}</b> / Revisão: <b>${formatarKm(top.v.kmRevisao)}</b>
          </div>
          <div class="prog-bar-wrap">
            <div class="prog-bar-fill ${top.st.vencida ? 'danger' : top.st.alerta ? 'warning' : ''}" style="width:${top.st.percent}%"></div>
          </div>
          <div style="margin-top:6px;font-size:12px;font-weight:600;color:${top.st.vencida ? 'var(--danger)' : 'var(--muted)'}">
            ${top.st.falta <= 0 ? `Vencida há ${formatarKm(Math.abs(top.st.falta))} km` : `Faltam ${formatarKm(top.st.falta)} km para a revisão`}
          </div>
        `;
      } else {
        boxRev.innerHTML = '<p style="color:var(--muted)">Nenhum veículo aguardando revisão.</p>';
      }

      // Últimas viagens
      const boxTrips = document.getElementById('dashboardRecentTrips');
      const ultimas = appData.registros.slice(-3).reverse();
      if (ultimas.length > 0) {
        boxTrips.innerHTML = ultimas.map(r => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0f4f0;">
            <div>
              <strong>${esc(r.veiculo)}</strong> <span class="plate-tag">${esc(r.placa)}</span>
              <div style="font-size:11px;color:var(--muted)">Motorista: <b>${esc(r.condutor)}</b> em ${formatarDataBR(r.data)}</div>
            </div>
            <div style="text-align:right">
              <span style="font-weight:700;color:var(--green-dark);">+${formatarKm(r.kmRodados)} km</span>
              <div style="font-size:10px;color:var(--muted)">${r.horaSaida} - ${r.horaRetorno}</div>
            </div>
          </div>
        `).join('');
      } else {
        boxTrips.innerHTML = '<p style="color:var(--muted)">Nenhuma utilização registrada.</p>';
      }

      // Tabela de resumo
      const tb = document.getElementById('overviewRows');
      tb.innerHTML = appData.veiculos.slice(0, 6).map(v => {
        const st = statusRevisaoVeiculo(v);
        return `
          <tr>
            <td><strong>${esc(v.modelo)}</strong></td>
            <td>${renderPlacaBadgeHtml(v.placa)}</td>
            <td>${esc(v.condutor)}</td>
            <td><b>${formatarKm(v.kmAtual)}</b> km</td>
            <td>${formatarKm(v.kmRevisao)} km</td>
            <td><span class="status-badge ${st.classe}">${st.texto}</span></td>
          </tr>
        `;
      }).join('');
    }

    /* ========================================================
       2. VEÍCULOS (CRUD COMPLETO)
       ======================================================== */
    function renderListaVeiculos() {
      filtrarVeiculos();
    }

    function filtrarVeiculos() {
      const busca = (document.getElementById('buscaVeiculo')?.value || '').trim().toLowerCase();
      const tipo = document.getElementById('filtroTipoVeiculo')?.value || 'todos';
      const statusFiltro = document.getElementById('filtroStatusRevisao')?.value || 'todos';

      const tabela = document.getElementById('listaVeiculosTabela');
      if (!tabela) return;

      const filtrados = appData.veiculos.filter((v, idx) => {
        const fPlaca = (v.placa || '').toLowerCase();
        const fModelo = (v.modelo || '').toLowerCase();
        const fCondutor = (v.condutor || '').toLowerCase();
        const bateBusca = !busca || fPlaca.includes(busca) || fModelo.includes(busca) || fCondutor.includes(busca);

        const isAlugado = (appData.placasAlugados || []).includes(v.placa);
        const bateTipo = tipo === 'todos' || (tipo === 'alugado' && isAlugado) || (tipo === 'proprio' && !isAlugado);

        const st = statusRevisaoVeiculo(v);
        const bateStatus = statusFiltro === 'todos'
          || (statusFiltro === 'vencida' && st.vencida)
          || (statusFiltro === 'atencao' && st.alerta && !st.vencida)
          || (statusFiltro === 'ok' && !st.alerta);

        return bateBusca && bateTipo && bateStatus;
      });

      if (filtrados.length === 0) {
        tabela.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted);">Nenhum veículo encontrado com os filtros aplicados.</td></tr>';
        return;
      }

      tabela.innerHTML = filtrados.map(v => {
        const idx = appData.veiculos.indexOf(v);
        const isAlugado = (appData.placasAlugados || []).includes(v.placa);
        const st = statusRevisaoVeiculo(v);

        return `
          <tr>
            <td>${renderPlacaBadgeHtml(v.placa)}</td>
            <td><strong>${esc(v.modelo)}</strong></td>
            <td><span class="status-badge ${isAlugado ? 'status-alerta' : 'status-ok'}">${isAlugado ? 'Alugado' : 'Próprio'}</span></td>
            <td>${esc(v.condutor)}</td>
            <td><b>${formatarKm(v.kmAtual)}</b> km</td>
            <td>${formatarKm(v.kmRevisao)} km</td>
            <td><span class="status-badge ${st.classe}">${st.texto}</span></td>
            <td style="text-align:right">
              <div class="acoes" style="justify-content:flex-end;">
                <button type="button" class="btn-sm secondary" onclick="editarVeiculo(${idx})">✏️ Editar</button>
                <button type="button" class="btn-sm btn-danger" onclick="excluirVeiculo(${idx})">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    function abrirModalVeiculo(indice = null) {
      const modal = document.getElementById('modalVeiculo');
      const form = document.getElementById('formVeiculoModal');
      form.reset();

      // Preenche condutores no select
      const selCondutor = document.getElementById('modalCondutor');
      selCondutor.innerHTML = '<option value="">Selecione o condutor...</option>';
      appData.condutores.forEach(c => {
        selCondutor.innerHTML += `<option value="${esc(c)}">${esc(c)}</option>`;
      });

      if (indice !== null && appData.veiculos[indice]) {
        const v = appData.veiculos[indice];
        document.getElementById('modalVeiculoTitulo').textContent = 'Editar Veículo';
        document.getElementById('modalVeiculoIndex').value = indice;
        document.getElementById('modalModelo').value = v.modelo;
        document.getElementById('modalPlaca').value = v.placa;
        document.getElementById('modalCondutor').value = v.condutor;
        document.getElementById('modalKmAtual').value = v.kmAtual;
        document.getElementById('modalKmRevisao').value = v.kmRevisao;

        const isAlugado = (appData.placasAlugados || []).includes(v.placa);
        document.getElementById('modalTipo').value = isAlugado ? 'alugado' : 'proprio';
      } else {
        document.getElementById('modalVeiculoTitulo').textContent = 'Cadastrar Novo Veículo';
        document.getElementById('modalVeiculoIndex').value = '';
        document.getElementById('modalKmRevisao').value = 10000;
        document.getElementById('modalKmAtual').value = 0;
      }

      modal.classList.add('open');
    }

    function fecharModalVeiculo() {
      document.getElementById('modalVeiculo').classList.remove('open');
    }

    function salvarVeiculoModal(event) {
      event.preventDefault();
      const idxStr = document.getElementById('modalVeiculoIndex').value;
      const modelo = document.getElementById('modalModelo').value.trim().toUpperCase();
      const placa = formatarPlaca(document.getElementById('modalPlaca').value.trim().toUpperCase());
      const tipo = document.getElementById('modalTipo').value;
      const condutor = document.getElementById('modalCondutor').value;
      const kmAtual = Number(document.getElementById('modalKmAtual').value);
      const kmRevisao = Number(document.getElementById('modalKmRevisao').value);

      if (!modelo || !placa || !condutor) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
      }

      const idx = idxStr !== '' ? Number(idxStr) : -1;

      // Validação de placa duplicada
      const placaExistente = appData.veiculos.find((v, i) => i !== idx && v.placa === placa);
      if (placaExistente) {
        alert(`A placa ${placa} já está cadastrada no veículo ${placaExistente.modelo}.`);
        return;
      }

      if (idx >= 0) {
        // Editando veículo existente
        const placaAntiga = appData.veiculos[idx].placa;
        appData.veiculos[idx] = { modelo, placa, condutor, kmAtual, kmRevisao };

        // Atualiza placa nos registros históricos
        appData.registros.forEach(r => {
          if (r.veiculoIndex === idx || r.placa === placaAntiga) {
            r.veiculo = modelo;
            r.placa = placa;
          }
        });

        // Atualiza alugados
        appData.placasAlugados = (appData.placasAlugados || []).filter(p => p !== placaAntiga);
        if (tipo === 'alugado') appData.placasAlugados.push(placa);

        mostrarToast(`Veículo ${modelo} (${placa}) atualizado com sucesso!`, 'success');
      } else {
        // Novo veículo
        const novo = { modelo, placa, condutor, kmAtual, kmRevisao };
        appData.veiculos.push(novo);
        if (tipo === 'alugado') {
          appData.placasAlugados = appData.placasAlugados || [];
          appData.placasAlugados.push(placa);
        }
        mostrarToast(`Veículo ${modelo} (${placa}) cadastrado com sucesso!`, 'success');
      }

      salvarLocalmente(true);
      fecharModalVeiculo();
      renderListaVeiculos();
      renderDashboard();
    }

    function editarVeiculo(indice) {
      abrirModalVeiculo(indice);
    }

    function excluirVeiculo(indice) {
      const v = appData.veiculos[indice];
      if (!v) return;

      const viagensVinculadas = appData.registros.filter(r => r.placa === v.placa || r.veiculoIndex === indice).length;
      let msg = `Tem certeza que deseja excluir o veículo ${v.modelo} - ${v.placa}?`;
      if (viagensVinculadas > 0) {
        msg += `\n\n⚠️ Atenção: Existem ${viagensVinculadas} registros de viagem vinculados a este veículo.`;
      }

      if (!confirm(msg)) return;

      appData.veiculos.splice(indice, 1);
      appData.placasAlugados = (appData.placasAlugados || []).filter(p => p !== v.placa);

      // Reindexar referências se necessário
      appData.registros.forEach(r => {
        if (r.veiculoIndex === indice) r.veiculoIndex = null;
        else if (r.veiculoIndex > indice) r.veiculoIndex -= 1;
      });

      salvarLocalmente(true);
      renderListaVeiculos();
      renderDashboard();
      mostrarToast(`Veículo ${v.modelo} removido da frota.`, 'info');
    }

    /* ========================================================
       3. SAÍDA E RETORNO (REGISTROS DE VIAGEM)
       ======================================================== */
    function prepararFormularioRegistro() {
      // Popula veículos
      const selVeiculo = document.getElementById('regVeiculo');
      const valorAtual = selVeiculo.value;
      selVeiculo.innerHTML = '<option value="">Selecione o veículo...</option>';
      appData.veiculos.forEach((v, i) => {
        selVeiculo.innerHTML += `<option value="${i}">${esc(v.modelo)} — ${esc(v.placa)} (KM Atual: ${formatarKm(v.kmAtual)})</option>`;
      });
      if (valorAtual) selVeiculo.value = valorAtual;

      // Popula condutores
      const selCondutor = document.getElementById('regCondutor');
      const condAtual = selCondutor.value;
      selCondutor.innerHTML = '<option value="">Selecione o condutor...</option>';
      appData.condutores.forEach(c => {
        selCondutor.innerHTML += `<option value="${esc(c)}">${esc(c)}</option>`;
      });
      if (condAtual) selCondutor.value = condAtual;

      // Padrão hoje se vazio
      if (!document.getElementById('regData').value) {
        colocarDataHoje();
      }
    }

    function aoSelecionarVeiculoNoRegistro() {
      const idx = document.getElementById('regVeiculo').value;
      if (idx === '') return;
      const v = appData.veiculos[Number(idx)];
      if (!v) return;

      // Auto-preenche o KM de saída com o KM atual do veículo
      document.getElementById('regKmSaida').value = v.kmAtual || 0;

      // Auto-preenche o condutor padrão
      if (v.condutor && appData.condutores.includes(v.condutor)) {
        document.getElementById('regCondutor').value = v.condutor;
      }

      calcularKmRodadosDinamico();
    }

    function calcularKmRodadosDinamico() {
      const saida = Number(document.getElementById('regKmSaida').value || 0);
      const chegada = Number(document.getElementById('regKmChegada').value || 0);
      const box = document.getElementById('boxCalculoKm');
      const texto = document.getElementById('textoCalculoKm');

      if (chegada > 0 && saida > 0) {
        box.style.display = 'block';
        if (chegada >= saida) {
          const rodados = chegada - saida;
          box.style.background = '#f0f8ee';
          box.style.borderColor = '#c7e6c1';
          texto.style.color = 'var(--green-dark)';
          texto.innerHTML = `Distância calculada: <b>${formatarKm(rodados)} km rodados</b> nesta utilização.`;
        } else {
          box.style.background = '#fff0f0';
          box.style.borderColor = '#f5c6c6';
          texto.style.color = 'var(--danger)';
          texto.innerHTML = `⚠️ O KM de chegada (${formatarKm(chegada)}) é MENOR que o KM de saída (${formatarKm(saida)}).`;
        }
      } else {
        box.style.display = 'none';
      }
    }

    function colocarDataHoje() {
      const hoje = new Date();
      const local = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000);
      document.getElementById('regData').value = local.toISOString().split('T')[0];
    }

    function preencherHorarioAtual() {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const hora = `${hh}:${mm}`;

      if (!document.getElementById('regHoraSaida').value) {
        document.getElementById('regHoraSaida').value = hora;
      } else {
        document.getElementById('regHoraRetorno').value = hora;
      }
    }

    function limparFormularioRegistro() {
      document.getElementById('formRegistro').reset();
      editandoRegistroId = null;
      document.getElementById('tituloRegistro').textContent = 'Registrar Saída e Retorno';
      document.getElementById('btnSalvarRegistro').textContent = '💾 Salvar Registro';
      document.getElementById('boxCalculoKm').style.display = 'none';
      colocarDataHoje();
    }

    document.getElementById('formRegistro').addEventListener('submit', function(e) {
      e.preventDefault();

      const veiculoIdx = Number(document.getElementById('regVeiculo').value);
      const condutor = document.getElementById('regCondutor').value;
      const data = document.getElementById('regData').value;
      const horaSaida = document.getElementById('regHoraSaida').value;
      const horaRetorno = document.getElementById('regHoraRetorno').value;
      const kmSaida = Number(document.getElementById('regKmSaida').value);
      const kmChegada = Number(document.getElementById('regKmChegada').value);

      const v = appData.veiculos[veiculoIdx];
      if (!v) {
        alert('Por favor, selecione um veículo válido.');
        return;
      }

      if (kmChegada < kmSaida) {
        alert('O KM de chegada não pode ser menor que o KM de saída.');
        return;
      }

      const kmRodados = kmChegada - kmSaida;

      if (editandoRegistroId) {
        // Atualiza viagem existente
        const rIndex = appData.registros.findIndex(r => r.id === editandoRegistroId);
        if (rIndex >= 0) {
          appData.registros[rIndex] = {
            id: editandoRegistroId,
            veiculo: v.modelo,
            placa: v.placa,
            veiculoIndex: veiculoIdx,
            condutor,
            data,
            horaSaida,
            horaRetorno,
            kmSaida,
            kmChegada,
            kmRodados
          };
        }
        mostrarToast('Registro de viagem atualizado com sucesso!', 'success');
      } else {
        // Nova viagem
        const novoRegistro = {
          id: Date.now(),
          veiculo: v.modelo,
          placa: v.placa,
          veiculoIndex: veiculoIdx,
          condutor,
          data,
          horaSaida,
          horaRetorno,
          kmSaida,
          kmChegada,
          kmRodados
        };
        appData.registros.push(novoRegistro);
        mostrarToast(`Viagem de ${v.modelo} salva com sucesso (+${formatarKm(kmRodados)} km)!`, 'success');
      }

      // Atualiza KM atual do veículo caso a chegada seja superior
      if (kmChegada > Number(v.kmAtual || 0)) {
        v.kmAtual = kmChegada;
      }

      const autoPush = document.getElementById('checkAutoPush')?.checked;
      salvarLocalmente(autoPush);
      limparFormularioRegistro();
      renderDashboard();
    });

    /* ========================================================
       4. REVISÕES E ALERTAS
       ======================================================== */
    function renderRevisoes() {
      const tipo = document.getElementById('filtroTipoRevisao')?.value || 'alugados';
      const tabela = document.getElementById('listaRevisoesTabela');
      if (!tabela) return;

      const lista = appData.veiculos.filter(v => {
        if (tipo === 'alugados') return (appData.placasAlugados || []).includes(v.placa);
        return true;
      });

      if (lista.length === 0) {
        tabela.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--muted);">Nenhum veículo nesta categoria para acompanhamento.</td></tr>';
        return;
      }

      tabela.innerHTML = lista.map(v => {
        const idx = appData.veiculos.indexOf(v);
        const st = statusRevisaoVeiculo(v);

        return `
          <tr>
            <td>${renderPlacaBadgeHtml(v.placa)}</td>
            <td><strong>${esc(v.modelo)}</strong></td>
            <td>${esc(v.condutor)}</td>
            <td><b>${formatarKm(v.kmAtual)}</b> km</td>
            <td>${formatarKm(v.kmRevisao)} km</td>
            <td style="font-weight:600;color:${st.vencida ? 'var(--danger)' : st.alerta ? 'var(--warning)' : 'var(--ink)'}">
              ${st.falta <= 0 ? `Vencida em ${formatarKm(Math.abs(st.falta))} km` : `${formatarKm(st.falta)} km`}
            </td>
            <td style="width:140px;">
              <div class="prog-bar-wrap">
                <div class="prog-bar-fill ${st.vencida ? 'danger' : st.alerta ? 'warning' : ''}" style="width:${st.percent}%"></div>
              </div>
            </td>
            <td><span class="status-badge ${st.classe}">${st.texto}</span></td>
            <td style="text-align:right">
              <div class="acoes" style="justify-content:flex-end;">
                <button type="button" class="btn-sm primary" onclick="registrarRevisaoFeita(${idx})" title="Registrar que a revisão foi feita e adiantar 10.000 km">✅ Feita (+10k)</button>
                <button type="button" class="btn-sm secondary" onclick="editarVeiculo(${idx})">✏️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    function registrarRevisaoFeita(indice) {
      const v = appData.veiculos[indice];
      if (!v) return;

      const proximoKm = Math.max(v.kmAtual, v.kmRevisao) + 10000;
      if (confirm(`Confirmar que a revisão do veículo ${v.modelo} (${v.placa}) foi realizada?\n\nA próxima revisão será ajustada para ${formatarKm(proximoKm)} km.`)) {
        v.kmRevisao = proximoKm;
        salvarLocalmente(true);
        renderRevisoes();
        renderDashboard();
        mostrarToast(`Revisão de ${v.modelo} registrada! Próxima aos ${formatarKm(proximoKm)} km.`, 'success');
      }
    }

    /* ========================================================
       5. HISTÓRICO COMPLETO
       ======================================================== */
    function renderHistorico() {
      filtrarHistorico();
    }

    function filtrarHistorico() {
      const busca = (document.getElementById('buscaHistorico')?.value || '').trim().toLowerCase();
      const dataDe = document.getElementById('filtroDataDe')?.value;
      const dataAte = document.getElementById('filtroDataAte')?.value;

      const tabela = document.getElementById('listaHistoricoTabela');
      if (!tabela) return;

      const filtrados = appData.registros.filter(r => {
        const bateTexto = !busca
          || (r.veiculo || '').toLowerCase().includes(busca)
          || (r.placa || '').toLowerCase().includes(busca)
          || (r.condutor || '').toLowerCase().includes(busca);

        const bateDe = !dataDe || r.data >= dataDe;
        const bateAte = !dataAte || r.data <= dataAte;

        return bateTexto && bateDe && bateAte;
      }).slice().reverse();

      if (filtrados.length === 0) {
        tabela.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--muted);">Nenhum registro encontrado.</td></tr>';
        return;
      }

      tabela.innerHTML = filtrados.map(r => `
        <tr>
          <td><strong>${formatarDataBR(r.data)}</strong></td>
          <td>${esc(r.veiculo)}</td>
          <td><span class="plate-tag">${esc(r.placa)}</span></td>
          <td>${esc(r.condutor)}</td>
          <td>${r.horaSaida || '--:--'}</td>
          <td>${r.horaRetorno || '--:--'}</td>
          <td>${formatarKm(r.kmSaida)}</td>
          <td>${formatarKm(r.kmChegada)}</td>
          <td><strong style="color:var(--green-dark)">+${formatarKm(r.kmRodados)} km</strong></td>
          <td style="text-align:right">
            <div class="acoes" style="justify-content:flex-end;">
              <button class="btn-sm secondary" onclick="editarRegistroViagem(${r.id})">✏️</button>
              <button class="btn-sm btn-danger" onclick="excluirRegistroViagem(${r.id})">🗑️</button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    function editarRegistroViagem(id) {
      const r = appData.registros.find(x => x.id === id);
      if (!r) return;

      navegarPara('registro');
      editandoRegistroId = id;
      document.getElementById('tituloRegistro').textContent = `Editando Viagem de ${r.veiculo} (${r.placa})`;
      document.getElementById('btnSalvarRegistro').textContent = '💾 Atualizar Viagem';

      // Preenche campos
      document.getElementById('regVeiculo').value = r.veiculoIndex != null ? r.veiculoIndex : '';
      document.getElementById('regCondutor').value = r.condutor;
      document.getElementById('regData').value = r.data;
      document.getElementById('regHoraSaida').value = r.horaSaida;
      document.getElementById('regHoraRetorno').value = r.horaRetorno;
      document.getElementById('regKmSaida').value = r.kmSaida;
      document.getElementById('regKmChegada').value = r.kmChegada;

      calcularKmRodadosDinamico();
      mostrarToast('Modo de edição ativado para o registro.', 'info');
    }

    function excluirRegistroViagem(id) {
      if (!confirm('Deseja realmente excluir este registro de utilização?')) return;
      appData.registros = appData.registros.filter(r => r.id !== id);
      salvarLocalmente(true);
      renderHistorico();
      renderDashboard();
      mostrarToast('Registro de utilização excluído.', 'info');
    }

    function exportarHistoricoCSV() {
      if (appData.registros.length === 0) {
        alert('Não há registros para exportar.');
        return;
      }
      let csv = 'Data;Veiculo;Placa;Condutor;Hora Saida;Hora Retorno;KM Saida;KM Chegada;KM Rodados\n';
      appData.registros.forEach(r => {
        csv += `${r.data};"${r.veiculo}";${r.placa};"${r.condutor}";${r.horaSaida};${r.horaRetorno};${r.kmSaida};${r.kmChegada};${r.kmRodados}\n`;
      });
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historico-frota-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    /* ========================================================
       6. CONDUTORES
       ======================================================== */
    function renderCondutores() {
      const tabela = document.getElementById('listaCondutoresTabela');
      if (!tabela) return;

      const ordenados = [...appData.condutores].sort((a,b) => a.localeCompare(b, 'pt-BR'));
      tabela.innerHTML = ordenados.map(nome => {
        const veiculoPadrao = appData.veiculos.find(v => v.condutor === nome);
        const totalViagens = appData.registros.filter(r => r.condutor === nome).length;

        return `
          <tr>
            <td><strong>${esc(nome)}</strong></td>
            <td>${veiculoPadrao ? `${esc(veiculoPadrao.modelo)} <span class="plate-tag">${esc(veiculoPadrao.placa)}</span>` : '<span style="color:var(--muted)">Nenhum fixo</span>'}</td>
            <td><b>${totalViagens}</b> utilização(ões)</td>
            <td style="text-align:right">
              <button class="btn-sm btn-danger" onclick="excluirCondutor('${esc(nome)}')">🗑️ Excluir</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    function salvarNovoCondutor(event) {
      event.preventDefault();
      const input = document.getElementById('nomeNovoCondutor');
      const nome = input.value.trim().toUpperCase();
      if (!nome) return;

      if (appData.condutores.some(c => c.toUpperCase() === nome)) {
        alert('Este condutor já está cadastrado.');
        return;
      }

      appData.condutores.push(nome);
      salvarLocalmente(true);
      input.value = '';
      renderCondutores();
      prepararFormularioRegistro();
      mostrarToast(`Condutor ${nome} adicionado com sucesso!`, 'success');
    }

    function excluirCondutor(nome) {
      if (!confirm(`Deseja realmente excluir o condutor "${nome}"?`)) return;
      appData.condutores = appData.condutores.filter(c => c !== nome);
      salvarLocalmente(true);
      renderCondutores();
      prepararFormularioRegistro();
      mostrarToast(`Condutor ${nome} removido.`, 'info');
    }

    /* ========================================================
       7. PASTAS POR VEÍCULO
       ======================================================== */
    function renderPastasVeiculos() {
      const select = document.getElementById('filtroVeiculoPasta');
      const atual = select.value;
      select.innerHTML = '<option value="">Selecione um veículo...</option>';
      appData.veiculos.forEach((v, idx) => {
        select.innerHTML += `<option value="${idx}">${esc(v.modelo)} — ${esc(v.placa)}</option>`;
      });
      if (atual) {
        select.value = atual;
        renderPastaSelecionada();
      }
    }

    function renderPastaSelecionada() {
      const idx = document.getElementById('filtroVeiculoPasta').value;
      const container = document.getElementById('conteudoPastaVeiculo');

      if (idx === '') {
        container.innerHTML = '<p style="color:var(--muted)">Selecione um veículo acima para visualizar o histórico exclusivo.</p>';
        return;
      }

      const v = appData.veiculos[Number(idx)];
      if (!v) return;

      const st = statusRevisaoVeiculo(v);
      const isAlugado = (appData.placasAlugados || []).includes(v.placa);
      const viagens = appData.registros.filter(r => r.placa === v.placa || r.veiculoIndex === Number(idx)).reverse();
      const totalKm = viagens.reduce((acc, r) => acc + Number(r.kmRodados || 0), 0);

      container.innerHTML = `
        <div class="pasta-card">
          <div class="pasta-info">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
              ${renderPlacaBadgeHtml(v.placa)}
              <h3 style="margin:0">${esc(v.modelo)}</h3>
              <span class="status-badge ${isAlugado ? 'status-alerta' : 'status-ok'}">${isAlugado ? 'Alugado' : 'Próprio'}</span>
              <span class="status-badge ${st.classe}">${st.texto}</span>
            </div>
            <div class="pasta-meta">
              <span>Condutor padrão: <b>${esc(v.condutor)}</b></span>
              <span>KM Atual: <b>${formatarKm(v.kmAtual)} km</b></span>
              <span>Próxima revisão: <b>${formatarKm(v.kmRevisao)} km</b></span>
              <span>Total acumulado nesta pasta: <b>${formatarKm(totalKm)} km</b></span>
            </div>
          </div>
          <div>
            <button class="btn btn-sm secondary" onclick="window.print()">🖨️ Imprimir Pasta</button>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Condutor</th>
                <th>Saída</th>
                <th>Retorno</th>
                <th>KM Saída</th>
                <th>KM Chegada</th>
                <th>KM Rodados</th>
              </tr>
            </thead>
            <tbody>
              ${viagens.length > 0 ? viagens.map(r => `
                <tr>
                  <td><strong>${formatarDataBR(r.data)}</strong></td>
                  <td>${esc(r.condutor)}</td>
                  <td>${r.horaSaida}</td>
                  <td>${r.horaRetorno}</td>
                  <td>${formatarKm(r.kmSaida)}</td>
                  <td>${formatarKm(r.kmChegada)}</td>
                  <td><strong style="color:var(--green-dark)">+${formatarKm(r.kmRodados)} km</strong></td>
                </tr>
              `).join('') : '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted)">Nenhuma utilização registrada para este veículo.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    }

    /* ========================================================
       8. EXPORTAÇÃO E IMPORTAÇÃO
       ======================================================== */
    function exportarBackupJson() {
      const dataStr = JSON.stringify(appData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-frota-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      mostrarToast('Backup JSON exportado com sucesso!', 'success');
    }

    function importarBackupJson(event) {
      const arquivo = event.target.files[0];
      if (!arquivo) return;

      const leitor = new FileReader();
      leitor.onload = function(e) {
        try {
          const dados = JSON.parse(e.target.result);
          if (!dados || !Array.isArray(dados.veiculos) || !Array.isArray(dados.condutores)) {
            throw new Error('Arquivo de backup inválido ou incompatível.');
          }
          if (confirm('Deseja restaurar este backup? Todos os dados atuais serão atualizados com os dados do arquivo.')) {
            appData = dados;
            salvarLocalmente(true);
            rotear();
            mostrarToast('Backup restaurado com sucesso!', 'success');
          }
        } catch (err) {
          alert('Erro ao importar backup: ' + err.message);
        }
        event.target.value = '';
      };
      leitor.readAsText(arquivo);
    }

    function baixarHtmlCompleto() {
      const clone = document.documentElement.cloneNode(true);
      const scriptDados = clone.querySelector('#dadosIncorporados');
      if (scriptDados) scriptDados.textContent = JSON.stringify(appData, null, 2);

      const html = '<!DOCTYPE html>\n' + clone.outerHTML;
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `controle-veiculos-${new Date().toISOString().slice(0,10)}.html`;
      a.click();
      URL.revokeObjectURL(url);
      mostrarToast('HTML com dados atuais baixado com sucesso!', 'success');
    }

    /* ========================================================
       INICIALIZAÇÃO
       ======================================================== */
    window.addEventListener('DOMContentLoaded', () => {
      // Carrega auto-push configurado
      const autoPushSalvo = localStorage.getItem('auto_push_github');
      if (autoPushSalvo !== null) {
        const ativado = autoPushSalvo === '1';
        const ch1 = document.getElementById('checkAutoPush');
        const ch2 = document.getElementById('checkAutoPushConfig');
        if (ch1) ch1.checked = ativado;
        if (ch2) ch2.checked = ativado;
      }

      // Token salvo
      const tk = localStorage.getItem('gh_token');
      if (tk && document.getElementById('inputGitToken')) {
        document.getElementById('inputGitToken').value = tk;
      }

      testarServidorLocal();
      rotear();
    });
  