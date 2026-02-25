import fp from 'fastify-plugin'
import multipart from '@fastify/multipart'
import type { FastifyInstance } from 'fastify'

async function multipartPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(multipart, {
    limits: {
      fileSize: 0, // 0 = unlimited per user decision "no file size limit"
      files: 1,
      parts: 10,
    },
  })
}

export default fp(multipartPlugin)
