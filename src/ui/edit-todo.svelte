<!-- edit-todo.svelte -->
<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import * as chrono from 'chrono-node';

  export let onSubmit;
  export let modalEl; // Receive the modal element from the parent

  let dateInput = '';
  let parsedDate = null;

  const dispatch = createEventDispatcher();

  function handleInput() {
    if (dateInput.trim() !== '') {
      const dateInputNormalized = dateInput.replace(/\btom\b/gi, 'tomorrow');
      const results = chrono.parse(dateInputNormalized, new Date(), { forwardDate: true });
      if (results.length > 0) {
        parsedDate = results[0].start.date();
      } else {
        parsedDate = null;
      }
    } else {
      parsedDate = null;
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      submit();
    }
  }

  function submit() {
    if (parsedDate) {
      onSubmit(parsedDate);
    } else {
      if (modalEl) {
        modalEl.classList.add('shake');
        setTimeout(() => {
          modalEl.classList.remove('shake');
        }, 500);
      }
    }
  }

  onMount(() => {
    handleInput(); // Initial parse
    const inputElement = document.getElementById('dateInput');
    if (inputElement) {
      inputElement.focus();
    }
  });
</script>

<input
  id="dateInput"
  type="text"
  aria-label="Enter new date for the task"
  bind:value="{dateInput}"
  on:input="{handleInput}"
  on:keydown="{handleKeydown}"
  placeholder="Enter date (e.g., 'tomorrow', 'next Friday')"
  style="width: 100%; padding: 0.5em; font-size: 1em;"
/>

<style>
  .shake {
    animation: shake 0.5s;
  }
  @keyframes shake {
    0% { transform: translateX(0); }
    25% { transform: translateX(-10px); }
    50% { transform: translateX(10px); }
    75% { transform: translateX(-10px); }
    100% { transform: translateX(0); }
  }
</style>