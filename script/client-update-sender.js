document.addEventListener('DOMContentLoaded', () => {
  const storageKey = 'tbfnClientUpdateDraft';
  const defaultSteps = [
    'Project intake form',
    'Logo or brand assets',
    'Website copy and page content',
    'Photos or visual assets',
    'Homepage design',
    'Inner page design',
    'Responsive development',
    'Forms and booking links',
    'Client review and feedback',
    'Invoice or payment',
    'Final approval',
    'Launch'
  ];
  const statusOptions = [
    { value: 'needed', label: 'Needed' },
    { value: 'inProcess', label: 'In Process' },
    { value: 'done', label: 'Done' },
    { value: 'skip', label: 'Skip' }
  ];
  const statusGroups = {
    needed: 'Needed from you',
    inProcess: 'In process now',
    done: 'Already handled'
  };

  const fields = {
    clientName: document.getElementById('clientName'),
    clientEmail: document.getElementById('clientEmail'),
    projectName: document.getElementById('projectName'),
    formUrl: document.getElementById('formUrl'),
    subjectLine: document.getElementById('subjectLine'),
    extraNote: document.getElementById('extraNote')
  };
  const stepList = document.getElementById('stepList');
  const customStepInput = document.getElementById('customStepInput');
  const addCustomStepBtn = document.getElementById('addCustomStepBtn');
  const emailPreview = document.getElementById('emailPreview');
  const sendUpdateBtn = document.getElementById('sendUpdateBtn');
  const copyEmailBtn = document.getElementById('copyEmailBtn');
  const copySubjectBtn = document.getElementById('copySubjectBtn');
  const resetUpdateTool = document.getElementById('resetUpdateTool');
  const resetUpdateToolTop = document.getElementById('resetUpdateToolTop');
  const draftClientLabel = document.getElementById('draftClientLabel');
  const draftMetaLabel = document.getElementById('draftMetaLabel');
  const notice = document.getElementById('updateSenderNotice');
  const noticeText = document.getElementById('updateSenderNoticeText');

  let steps = defaultSteps.map((label) => ({ id: makeId(label), label, status: 'skip' }));

  function makeId(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || `step-${Date.now()}`;
  }

  function cleanValue(value) {
    return String(value || '').trim();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function showNotice(message, tone = 'info') {
    if (!notice || !noticeText) return;
    notice.hidden = false;
    notice.classList.remove('portal-alert-info', 'portal-alert-success', 'portal-alert-warning');
    notice.classList.add(tone === 'success' ? 'portal-alert-success' : tone === 'warning' ? 'portal-alert-warning' : 'portal-alert-info');
    noticeText.textContent = message;
    window.setTimeout(() => {
      notice.hidden = true;
      noticeText.textContent = '';
    }, 3600);
  }

  function getDraft() {
    return {
      clientName: cleanValue(fields.clientName?.value),
      clientEmail: cleanValue(fields.clientEmail?.value),
      projectName: cleanValue(fields.projectName?.value),
      formUrl: cleanValue(fields.formUrl?.value),
      subjectLine: cleanValue(fields.subjectLine?.value),
      extraNote: cleanValue(fields.extraNote?.value),
      steps
    };
  }

  function saveDraft() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(getDraft()));
    } catch (error) {
      console.warn('Unable to save client update draft.', error);
    }
  }

  function loadDraft() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
      if (!saved || typeof saved !== 'object') return;

      Object.entries(fields).forEach(([key, field]) => {
        if (field && typeof saved[key] === 'string') {
          field.value = saved[key];
        }
      });

      if (Array.isArray(saved.steps) && saved.steps.length) {
        const savedById = new Map(saved.steps.map((step) => [step.id, step]));
        const mergedDefaultSteps = defaultSteps.map((label) => {
          const id = makeId(label);
          const savedStep = savedById.get(id);
          return {
            id,
            label,
            status: savedStep?.status || 'skip'
          };
        });
        const customSteps = saved.steps.filter((step) => {
          return step && step.id && !defaultSteps.some((label) => makeId(label) === step.id);
        });
        steps = [...mergedDefaultSteps, ...customSteps];
      }
    } catch (error) {
      console.warn('Unable to load client update draft.', error);
    }
  }

  function defaultSubject() {
    const clientName = cleanValue(fields.clientName?.value);
    const projectName = cleanValue(fields.projectName?.value);
    if (projectName) return `Next steps for ${projectName}`;
    if (clientName) return `Next steps for your TrueBit Forge North project`;
    return 'Next steps from TrueBit Forge North';
  }

  function syncSubjectIfEmpty() {
    if (!fields.subjectLine) return;
    if (!fields.subjectLine.value.trim() || fields.subjectLine.dataset.autoSubject === 'true') {
      fields.subjectLine.value = defaultSubject();
      fields.subjectLine.dataset.autoSubject = 'true';
    }
  }

  function buildMessage() {
    const draft = getDraft();
    const clientName = draft.clientName || 'there';
    const projectName = draft.projectName || 'your project';
    const groupedSteps = steps.reduce((groups, step) => {
      if (!statusGroups[step.status]) return groups;
      groups[step.status].push(step.label);
      return groups;
    }, { needed: [], inProcess: [], done: [] });
    const lines = [
      `Hi ${clientName},`,
      '',
      `Thank you for choosing TrueBit Forge North. Here is the current update for ${projectName}.`
    ];

    Object.entries(statusGroups).forEach(([status, heading]) => {
      if (!groupedSteps[status].length) return;
      lines.push('', `${heading}:`);
      groupedSteps[status].forEach((step) => {
        lines.push(`- ${step}`);
      });
    });

    if (draft.formUrl) {
      lines.push(
        '',
        'Form link:',
        draft.formUrl,
        '',
        'Please use that form for the next details, files, approvals, or feedback needed for this step.'
      );
    }

    if (draft.extraNote) {
      lines.push('', draft.extraNote);
    }

    lines.push(
      '',
      'Thank you,',
      'TrueBit Forge North LLC'
    );

    return lines.join('\n');
  }

  function renderSteps() {
    if (!stepList) return;
    stepList.innerHTML = steps.map((step) => {
      const safeLabel = escapeHtml(step.label);
      const statusButtons = statusOptions.map((option) => {
        const active = step.status === option.value;
        return `
          <button class="update-step-status${active ? ' active' : ''}" type="button"
            data-step-id="${step.id}" data-status="${option.value}" aria-pressed="${active}">
            ${option.label}
          </button>
        `;
      }).join('');

      return `
        <div class="update-step-item" data-step-row="${step.id}">
          <div class="update-step-title">${safeLabel}</div>
          <div class="update-step-controls" role="group" aria-label="${safeLabel} status">
            ${statusButtons}
          </div>
        </div>
      `;
    }).join('');
  }

  function updatePreview() {
    syncSubjectIfEmpty();
    if (emailPreview) {
      emailPreview.value = buildMessage();
    }

    const draft = getDraft();
    const activeCount = steps.filter((step) => step.status !== 'skip').length;

    if (draftClientLabel) {
      draftClientLabel.textContent = draft.clientName || 'No client selected yet';
    }

    if (draftMetaLabel) {
      const projectLabel = draft.projectName || 'Untitled project';
      draftMetaLabel.textContent = `${projectLabel} - ${activeCount} active step${activeCount === 1 ? '' : 's'}`;
    }

    saveDraft();
  }

  function setStepStatus(stepId, status) {
    steps = steps.map((step) => {
      if (step.id !== stepId) return step;
      return { ...step, status };
    });
    renderSteps();
    updatePreview();
  }

  async function copyText(value, successMessage) {
    try {
      await navigator.clipboard.writeText(value);
      showNotice(successMessage, 'success');
    } catch (error) {
      showNotice('Copy failed. Select the preview text and copy it manually.', 'warning');
    }
  }

  function sendEmail() {
    updatePreview();
    const draft = getDraft();

    if (!draft.clientEmail) {
      showNotice('Add the client email before sending.', 'warning');
      fields.clientEmail?.focus();
      return;
    }

    const subject = draft.subjectLine || defaultSubject();
    const body = emailPreview?.value || buildMessage();
    const mailtoUrl = `mailto:${encodeURIComponent(draft.clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    showNotice('Your email app should open with the draft ready to send.', 'success');
  }

  function addCustomStep() {
    const label = cleanValue(customStepInput?.value);
    if (!label) return;

    const idBase = makeId(label);
    let id = idBase;
    let index = 2;

    while (steps.some((step) => step.id === id)) {
      id = `${idBase}-${index}`;
      index += 1;
    }

    steps = [...steps, { id, label, status: 'needed' }];
    if (customStepInput) customStepInput.value = '';
    renderSteps();
    updatePreview();
  }

  function resetTool() {
    Object.values(fields).forEach((field) => {
      if (field) field.value = '';
    });
    steps = defaultSteps.map((label) => ({ id: makeId(label), label, status: 'skip' }));
    if (customStepInput) customStepInput.value = '';
    try {
      window.localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Unable to clear client update draft.', error);
    }
    renderSteps();
    updatePreview();
    showNotice('Started a fresh update draft.', 'success');
  }

  Object.values(fields).forEach((field) => {
    field?.addEventListener('input', () => {
      if (field.id === 'subjectLine') {
        field.dataset.autoSubject = field.value.trim() ? 'false' : 'true';
      }
      updatePreview();
    });
  });

  stepList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-step-id][data-status]');
    if (!button) return;
    setStepStatus(button.dataset.stepId, button.dataset.status);
  });

  addCustomStepBtn?.addEventListener('click', addCustomStep);
  customStepInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCustomStep();
    }
  });
  sendUpdateBtn?.addEventListener('click', sendEmail);
  copyEmailBtn?.addEventListener('click', () => copyText(emailPreview?.value || buildMessage(), 'Message copied.'));
  copySubjectBtn?.addEventListener('click', () => copyText(fields.subjectLine?.value || defaultSubject(), 'Subject copied.'));
  resetUpdateTool?.addEventListener('click', resetTool);
  resetUpdateToolTop?.addEventListener('click', resetTool);

  loadDraft();
  renderSteps();
  updatePreview();
});
