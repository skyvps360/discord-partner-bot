// Main JavaScript functionality for the Discord Partner Bot website

class DiscordBotDashboard {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadDashboardData();
    this.setupFormValidation();
    this.initializeTooltips();
  }

  setupEventListeners() {
    // Navigation active state
    this.setActiveNavLink();

    // Form submissions
    document.addEventListener('submit', this.handleFormSubmit.bind(this));

    // Button clicks
    document.addEventListener('click', this.handleButtonClick.bind(this));

    // Auto-refresh dashboard data
    if (window.location.pathname.includes('dashboard')) {
      setInterval(() => this.loadDashboardData(), 30000); // Refresh every 30 seconds
    }
  }

  setActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
      if (link.getAttribute('href') === currentPath) {
        link.classList.add('active');
      }
    });
  }

  async handleFormSubmit(event) {
    const form = event.target;
    
    if (form.classList.contains('ajax-form')) {
      event.preventDefault();
      await this.submitFormAjax(form);
    }
  }

  async submitFormAjax(form) {
    const formData = new FormData(form);
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;

    // Show loading state
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner"></span> Processing...';

    try {
      const response = await fetch(form.action, {
        method: form.method,
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        this.showAlert('success', result.message || 'Operation completed successfully!');
        if (result.redirect) {
          setTimeout(() => window.location.href = result.redirect, 1500);
        }
      } else {
        this.showAlert('error', result.message || 'An error occurred. Please try again.');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      this.showAlert('error', 'Network error. Please check your connection and try again.');
    } finally {
      // Reset button state
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }

  async handleButtonClick(event) {
    const button = event.target.closest('button');
    if (!button) return;

    // Handle specific button actions
    if (button.classList.contains('btn-bump')) {
      await this.handleBumpAction(button);
    } else if (button.classList.contains('btn-approve')) {
      await this.handleApprovalAction(button, 'approve');
    } else if (button.classList.contains('btn-reject')) {
      await this.handleApprovalAction(button, 'reject');
    }
  }

  async handleBumpAction(button) {
    const serverId = button.dataset.serverId;
    const originalText = button.textContent;

    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Bumping...';

    try {
      const response = await fetch('/api/bump', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serverId })
      });

      const result = await response.json();

      if (result.success) {
        this.showAlert('success', 'Bump sent successfully!');
        // Update cooldown timer if provided
        if (result.nextBumpTime) {
          this.startCooldownTimer(button, result.nextBumpTime);
        }
      } else {
        this.showAlert('error', result.message || 'Failed to send bump.');
        button.disabled = false;
        button.textContent = originalText;
      }
    } catch (error) {
      console.error('Bump error:', error);
      this.showAlert('error', 'Network error occurred.');
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async handleApprovalAction(button, action) {
    const itemId = button.dataset.itemId;
    const itemType = button.dataset.itemType;

    if (!confirm(`Are you sure you want to ${action} this ${itemType}?`)) {
      return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> ${action === 'approve' ? 'Approving' : 'Rejecting'}...`;

    try {
      const response = await fetch(`/api/admin/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId, itemType })
      });

      const result = await response.json();

      if (result.success) {
        this.showAlert('success', `${itemType} ${action}d successfully!`);
        // Remove the item from the list or update its status
        const row = button.closest('tr');
        if (row) {
          row.style.opacity = '0.5';
          setTimeout(() => row.remove(), 1000);
        }
      } else {
        this.showAlert('error', result.message || `Failed to ${action} ${itemType}.`);
        button.disabled = false;
        button.textContent = originalText;
      }
    } catch (error) {
      console.error('Approval action error:', error);
      this.showAlert('error', 'Network error occurred.');
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  startCooldownTimer(button, nextBumpTime) {
    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = nextBumpTime - now;

      if (distance > 0) {
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        button.textContent = `Cooldown: ${minutes}m ${seconds}s`;
        button.disabled = true;
      } else {
        button.textContent = 'Bump Server';
        button.disabled = false;
        clearInterval(timer);
      }
    };

    const timer = setInterval(updateTimer, 1000);
    updateTimer(); // Run immediately
  }

  async loadDashboardData() {
    try {
      const response = await fetch('/api/dashboard-stats');
      const data = await response.json();

      if (data.success) {
        this.updateDashboardStats(data.stats);
        this.updateServerList(data.servers);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  }

  updateDashboardStats(stats) {
    const statElements = {
      'total-servers': stats.totalServers,
      'active-partnerships': stats.activePartnerships,
      'pending-approvals': stats.pendingApprovals,
      'total-bumps': stats.totalBumps
    };

    Object.entries(statElements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        this.animateNumber(element, parseInt(element.textContent) || 0, value);
      }
    });
  }

  updateServerList(servers) {
    const serverListContainer = document.getElementById('server-list');
    if (!serverListContainer) return;

    // Update server list with new data
    // This would be implemented based on your specific server list structure
  }

  animateNumber(element, start, end) {
    const duration = 1000;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const current = Math.floor(start + (end - start) * progress);
      element.textContent = current.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  setupFormValidation() {
    const forms = document.querySelectorAll('form[data-validate]');
    
    forms.forEach(form => {
      const inputs = form.querySelectorAll('input, textarea, select');
      
      inputs.forEach(input => {
        input.addEventListener('blur', () => this.validateField(input));
        input.addEventListener('input', () => this.clearFieldError(input));
      });
    });
  }

  validateField(field) {
    const value = field.value.trim();
    const type = field.type;
    const required = field.hasAttribute('required');
    
    let isValid = true;
    let errorMessage = '';

    if (required && !value) {
      isValid = false;
      errorMessage = 'This field is required.';
    } else if (type === 'email' && value && !this.isValidEmail(value)) {
      isValid = false;
      errorMessage = 'Please enter a valid email address.';
    } else if (type === 'url' && value && !this.isValidUrl(value)) {
      isValid = false;
      errorMessage = 'Please enter a valid URL.';
    }

    if (!isValid) {
      this.showFieldError(field, errorMessage);
    } else {
      this.clearFieldError(field);
    }

    return isValid;
  }

  showFieldError(field, message) {
    this.clearFieldError(field);
    
    field.classList.add('error');
    const errorElement = document.createElement('div');
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    
    field.parentNode.appendChild(errorElement);
  }

  clearFieldError(field) {
    field.classList.remove('error');
    const errorElement = field.parentNode.querySelector('.field-error');
    if (errorElement) {
      errorElement.remove();
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  showAlert(type, message) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    // Create new alert
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    // Insert at the top of the main content
    const main = document.querySelector('main') || document.body;
    main.insertBefore(alert, main.firstChild);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 300);
    }, 5000);
  }

  initializeTooltips() {
    // Simple tooltip implementation
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
      element.addEventListener('mouseenter', this.showTooltip.bind(this));
      element.addEventListener('mouseleave', this.hideTooltip.bind(this));
    });
  }

  showTooltip(event) {
    const element = event.target;
    const text = element.getAttribute('data-tooltip');
    
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
  }

  hideTooltip() {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }
}

// Utility functions
const utils = {
  formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  formatNumber(num) {
    return num.toLocaleString();
  },

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      // Show success message
      const event = new CustomEvent('clipboard-copy', { detail: { text } });
      document.dispatchEvent(event);
    });
  }
};

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new DiscordBotDashboard();
});

// Add some additional CSS for form validation and tooltips
const additionalStyles = `
  .field-error {
    color: var(--error-color);
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }

  .form-input.error,
  .form-textarea.error,
  .form-select.error {
    border-color: var(--error-color);
    box-shadow: 0 0 0 3px rgba(240, 71, 71, 0.1);
  }

  .tooltip {
    position: absolute;
    background: var(--background-dark);
    color: var(--text-primary);
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
    z-index: 1000;
    border: 1px solid var(--border-color);
    box-shadow: var(--card-shadow);
  }

  .tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: var(--background-dark) transparent transparent transparent;
  }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);