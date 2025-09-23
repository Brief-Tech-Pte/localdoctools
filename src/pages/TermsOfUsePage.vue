<template>
  <q-page class="q-pa-xl">
    <div class="column items-center">
      <q-card flat bordered class="q-pa-xl" style="max-width: 960px; width: 100%">
        <q-card-section>
          <div class="text-h4 text-weight-bold q-mb-md">Terms of Use</div>
          <div class="text-caption text-grey-6 q-mb-xl">Last updated: {{ lastUpdated }}</div>

          <div class="q-gutter-md">
            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">1. Acceptance</h2>
              <p>
                By accessing or using Local Doc Tools (the "Service"), you agree to these Terms of
                Use and any policies referenced within. The Service is intended for users aged 18 or
                older, or for minors who have consent from a parent, guardian, or authorized
                supervisor.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">2. Service Description</h2>
              <p>
                The Service provides browser-based utilities for working with documents. Processing
                occurs entirely within your device, and the project does not transmit or store your
                files on remote servers. Output quality and performance may vary based on your
                device capabilities.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">3. Permitted Use</h2>
              <p>
                You may only process documents that you own or are authorized to handle. You must
                not upload or generate unlawful, infringing, or harmful content, nor may you attempt
                to reverse engineer, interfere with, or disrupt the Service. Automated access is
                prohibited unless expressly permitted.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">4. Ownership</h2>
              <p>
                You retain all rights to your documents and outputs. All intellectual property
                associated with the Service, including the user interface, branding, and underlying
                code, remains with the project maintainers and contributors, subject to open-source
                licenses noted in the project repository.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">5. Feedback</h2>
              <p>
                Any feedback or suggestions you provide may be used to improve the Service without
                obligation to you.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">6. Disclaimer</h2>
              <p>
                The Service is provided on an "as is" and "as available" basis without warranties of
                any kind. The Service is not a substitute for professional advice. You are
                responsible for verifying the accuracy of outputs and ensuring compliance with
                applicable laws or policies.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">7. Limitation of Liability</h2>
              <p>
                To the fullest extent permitted by law, the project maintainers are not liable for
                any indirect, incidental, special, consequential, or punitive damages arising from
                your use of the Service. Our total liability will not exceed the amount you paid to
                use the Service, which is currently zero.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">8. Indemnity</h2>
              <p>
                You agree to indemnify and hold harmless the project maintainers from claims,
                losses, or damages arising from your misuse of the Service or violation of these
                Terms of Use.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">9. Changes to the Service</h2>
              <p>
                We may update, suspend, or discontinue the Service at any time without notice.
                Continued use of the Service after changes to these Terms of Use constitutes your
                acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">10. Governing Law</h2>
              <p>
                These Terms of Use are governed by the laws of Singapore. Any disputes will be
                resolved exclusively in the courts of Singapore.
              </p>
            </section>

            <section>
              <h2 class="text-h6 text-weight-medium q-mb-sm">11. Contact</h2>
              <p>
                For questions about these Terms of Use, contact us at
                <a href="mailto:hello@localdoctools.example">hello@localdoctools.example</a>.
              </p>
            </section>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
const lastUpdated = '4 October 2024'
</script>

<style scoped>
section p {
  margin: 0;
}
</style>
