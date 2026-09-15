// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', function() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
    }

    // Close menu on link click
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            navMenu.classList.remove('active');
            hamburger.classList.remove('active');
        });
    });
});

// AI Assistant Modal Functions
function openAssistant() {
    document.getElementById('assistantModal').style.display = 'block';
}

// Open Chatbot
function openChatbot() {
    const chatbot = document.getElementById('chatbot-container');
    if (chatbot) {
        chatbot.classList.add('active');
    }
}

function closeAssistant() {
    document.getElementById('assistantModal').style.display = 'none';
}

function navigateTo(page, service) {
    console.log('Navigating to:', page);
    window.location.href = page;
}

function whatsappAssist() {
    const message = "Hello Souq Al Mena, I'd like to know more about your services. Can you guide me?";
    window.location.href = `https://wa.me/971502687989?text=${encodeURIComponent(message)}`;
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('assistantModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Form Submission Handler
function submitForm(formId, successMessage) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // Get form data
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        // Log form data (in production, send to backend)
        console.log('Form submitted:', data);

        // Show success message
        alert(successMessage || 'Thank you! We will contact you soon.');

        // Reset form
        form.reset();
    });
}

// Initialize tooltips
function initTooltips() {
    const tooltips = document.querySelectorAll('[title]');
    tooltips.forEach(elem => {
        elem.addEventListener('mouseenter', function() {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = this.getAttribute('title');
            document.body.appendChild(tooltip);

            const rect = this.getBoundingClientRect();
            tooltip.style.position = 'fixed';
            tooltip.style.top = (rect.top - 30) + 'px';
            tooltip.style.left = rect.left + 'px';
        });

        elem.addEventListener('mouseleave', function() {
            const tooltip = document.querySelector('.tooltip');
            if (tooltip) tooltip.remove();
        });
    });
}

// Lazy load images
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
}

// Track page analytics
function trackPageView(pageName) {
    console.log('Page viewed:', pageName);
    // This can be extended to send analytics to a service
}

// Initialize on page load
window.addEventListener('load', function() {
    initTooltips();
    lazyLoadImages();
    trackPageView(document.title);
});

// Utility: Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard!');
    }).catch(() => {
        alert('Failed to copy');
    });
}

// Utility: Format phone number
function formatPhoneNumber(phone) {
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
}

// Add CSS for tooltips dynamically
const tooltipStyle = document.createElement('style');
tooltipStyle.textContent = `
    .tooltip {
        background: var(--primary-dark);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 5px;
        font-size: 0.85rem;
        z-index: 9999;
        white-space: nowrap;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    }

    .nav-menu.active {
        display: flex;
        flex-direction: column;
        position: absolute;
        top: 100%;
        left: 0;
        width: 100%;
        background: var(--primary-charcoal);
        padding: 2rem 0;
        gap: 1rem;
    }

    .hamburger.active span:nth-child(1) {
        transform: rotate(45deg) translate(10px, 10px);
    }

    .hamburger.active span:nth-child(2) {
        opacity: 0;
    }

    .hamburger.active span:nth-child(3) {
        transform: rotate(-45deg) translate(7px, -7px);
    }
`;
document.head.appendChild(tooltipStyle);
