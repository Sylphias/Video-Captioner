import fp from 'fastify-plugin'
import multipart from '@fastify/multipart'
import type { FastifyInstance } from 'fastify'

async function multipartPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024 * 1024, // 10GB
      files: 1,
      parts: 10,
    },
  })
}

export default fp(multipartPlugin)
