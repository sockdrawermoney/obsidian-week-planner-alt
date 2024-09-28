<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import * as chrono from 'chrono-node';

  export let onSubmit;
  let modalEl;
  export let app;

  let dateInput = '';
  let parsedDate = null;
  let isTagInput = false;
  let tagSuggestions = [];
  let selectedTagIndex = -1;
  let showSuggestions = false;

  const dispatch = createEventDispatcher();

  function handleInput() {
    if (dateInput.trim() !== '') {
      if (dateInput.startsWith('#')) {
        isTagInput = true;
        updateTagSuggestions();
      } else {
        isTagInput = false;
        handleDateParsing();
      }
    } else {
      parsedDate = null;
      tagSuggestions = [];
      showSuggestions = false;
    }
  }

  function handleDateParsing() {
    const dateInputNormalized = dateInput.replace(/\btom\b/gi, 'tomorrow');
    const results = chrono.parse(dateInputNormalized, new Date(), { forwardDate: true });
    if (results.length > 0) {
      parsedDate = results[0].start.date();
    } else {
      parsedDate = null;
    }
  }

  function updateTagSuggestions() {
    const query = dateInput.slice(1).toLowerCase();
    const allTags = Object.keys(app.metadataCache.getTags()).map(tag => tag.startsWith('#') ? tag.slice(1) : tag);
    const filteredTags = allTags.filter(tag => tag.toLowerCase().includes(query));
    tagSuggestions = filteredTags.slice(0, 10); // Limit to 10 suggestions
    selectedTagIndex = -1;
    showSuggestions = tagSuggestions.length > 0;
  }

  function handleKeydown(e) {
    if (isTagInput && showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedTagIndex = (selectedTagIndex + 1) % tagSuggestions.length;
        dateInput = '#' + tagSuggestions[selectedTagIndex];
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedTagIndex = (selectedTagIndex - 1 + tagSuggestions.length) % tagSuggestions.length;
        dateInput = '#' + tagSuggestions[selectedTagIndex];
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        showSuggestions = false;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      submit();
    }
  }

  function submit() {
    if (isTagInput) {
      if (dateInput.trim() !== '#') {
        onSubmit(dateInput.trim());
      }
    } else if (parsedDate) {
      onSubmit(parsedDate);
    }
  }

  function selectSuggestion(tag) {
    dateInput = '#' + tag;
    showSuggestions = false;
    submit();
  }

  onMount(() => {
    const inputElement = document.getElementById('dateInput');
    if (inputElement) {
      inputElement.focus();
    }
  });
</script>

<div bind:this={modalEl} class="modal-container">
  <input
    id="dateInput"
    type="text"
    aria-label="Enter new date or tag for the task"
    bind:value={dateInput}
    on:input={handleInput}
    on:keydown={handleKeydown}
    placeholder="Enter date (e.g., 'tomorrow') or tag (e.g., '#project')"
    style="width: 100%; padding: 0.5em; font-size: 1em;"
    autocomplete="off"
  />
  <h1>Migrate this task</h1>
  {#if isTagInput && showSuggestions}
    <ul class="suggestions">
      {#each tagSuggestions as tag, index}
        <li class:active={index === selectedTagIndex} on:mousedown={() => selectSuggestion(tag)}>
          #{tag}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .modal-container {
    position: relative;
  }
  .suggestions {
    position: absolute;
    top: 2.5em;
    left: 0;
    right: 0;
    max-height: 10em;
    overflow-y: auto;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    z-index: 1000;
    padding: 0;
    margin: 0;
    list-style: none;
  }
  .suggestions li {
    padding: 0.5em;
    cursor: pointer;
  }
  .suggestions li.active,
  .suggestions li:hover {
    background: var(--background-modifier-hover);
  }
</style>
