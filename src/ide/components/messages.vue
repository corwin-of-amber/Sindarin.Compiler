<template>
  <ul class="ide--messages">
      <li v-for="(msg,$idx) in messages" :key="$idx"
          :class="msg.kind">{{msg.text}}</li>
  </ul>
</template>

<style>
.ide--messages {
    position: absolute;
    right: 1em;
    bottom: 1em;
    list-style: none;
}

.ide--messages > li {
    padding: 9px;
    font-family: monospace;
    font-size: 90%;
    white-space: pre;
    margin-top: 3px;
}

.ide--messages > li.error {
    background: #ffcccccc;
    border: 1px solid #800;
}
</style>

<script>
export default {
    props: ['messages']
}
</script>