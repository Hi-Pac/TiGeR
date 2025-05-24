function initHelpModule() {
    console.log("Help Module Initialized!");

    const helpModuleNode = document.getElementById('help-module');
    if (!helpModuleNode) return;

    // --- FAQ Accordion Logic ---
    const faqToggleButtons = helpModuleNode.querySelectorAll('.faq-toggle-btn');
    faqToggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const content = button.nextElementSibling; // The .faq-content div
            const icon = button.querySelector('i.fa-chevron-down');

            if (content) {
                // Close other open FAQs in the same container (optional)
                // const parentContainer = button.closest('#faq-accordion-container');
                // if (parentContainer) {
                //     parentContainer.querySelectorAll('.faq-content').forEach(otherContent => {
                //         if (otherContent !== content && !otherContent.classList.contains('hidden')) {
                //             otherContent.classList.add('hidden');
                //             otherContent.previousElementSibling.querySelector('i.fa-chevron-down')?.classList.remove('rotate-180');
                //         }
                //     });
                // }
                content.classList.toggle('hidden');
            }
            if (icon) {
                icon.classList.toggle('rotate-180');
            }
        });
    });

    // --- Smooth Scroll Buttons ---
    const faqScrollBtn = helpModuleNode.querySelector('.faq-scroll-btn');
    const contactSupportScrollBtn = helpModuleNode.querySelector('.contact-support-scroll-btn');
    const faqSection = helpModuleNode.querySelector('#faq-section');
    const contactSupportSection = helpModuleNode.querySelector('#contact-support-section');

    if (faqScrollBtn && faqSection) {
        faqScrollBtn.addEventListener('click', () => {
            faqSection.scrollIntoView({ behavior: 'smooth' });
        });
    }
    if (contactSupportScrollBtn && contactSupportSection) {
        contactSupportScrollBtn.addEventListener('click', () => {
            contactSupportSection.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // --- Contact Support Form Logic ---
    const contactSupportForm = helpModuleNode.querySelector('#contact-support-form');
    const sendSupportRequestBtn = helpModuleNode.querySelector('#send-support-request-btn');

    if (contactSupportForm && sendSupportRequestBtn) {
        contactSupportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            window.showButtonSpinner(sendSupportRequestBtn, true);

            const name = helpModuleNode.querySelector('#support-name-field').value;
            const email = helpModuleNode.querySelector('#support-email-field').value;
            const subject = helpModuleNode.querySelector('#support-subject-field').value;
            const message = helpModuleNode.querySelector('#support-message-field').value;
            const attachmentFile = helpModuleNode.querySelector('#support-attachment-field').files[0];

            // In a real application, you'd send this data to a backend or a service like Firebase Functions
            // which then emails it to your support team or creates a ticket.
            // For Firebase, you could write to a Firestore collection 'supportTickets'.

            console.log("Support Request:", { name, email, subject, message, attachment: attachmentFile ? attachmentFile.name : 'None' });
            
            try {
                // Simulate sending request
                await new Promise(resolve => setTimeout(resolve, 1500)); 
                alert("تم إرسال طلب الدعم بنجاح. سنتواصل معك قريبًا.");
                contactSupportForm.reset();
            } catch (error) {
                console.error("Error sending support request:", error);
                alert("حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.");
            } finally {
                window.showButtonSpinner(sendSupportRequestBtn, false);
            }
        });
    }

    // TODO: Load dynamic FAQs from Firebase if needed
    // TODO: Fetch user's name/email for the contact form if logged in
}
